// app/lib/forecastCache.server.ts
//
// Faz 5 öncesi zorunlu ön koşul: loader her istekte senkron olarak
// Shopify'dan veri çekip tahmini yeniden hesaplıyordu. Bu dosya sonucu
// ForecastSnapshot tablosunda önbelleğe alır (Bölüm 15, "A" kararı).
//
// Strateji:
// - Taze kayıt varsa (TTL içinde) doğrudan onu döndür, hiç hesaplama yapma.
// - Kayıt yoksa veya bayatladıysa yeniden hesapla ve kaydet.
// - "computing" kilidi: embedded app'in iframe + üst çerçeve yüzünden aynı
//   anda gelen iki istekten biri hesaplarken diğeri, elimizde veri varsa
//   (bayat da olsa) onu döndürür, ikinci bir hesaplamaya girmez. Bu, açık
//   madde 6'daki "loader iki kez çalışıyor" israfını da çözer.
// - Kilit LOCK_TIMEOUT_MS'den eskiyse (örn. sunucu çöktüyse) bayat sayılır,
//   yeni istek yine de hesaplar — takılı kalma riski yok.
//
// Not: Bu, tek sunuculu/SQLite ölçeğinde pragmatik bir çözüm. Tam
// dağıtık kilit garantisi vermez (ilk hiç veri yokken aynı anda gelen iki
// istek nadiren ikisi de hesaplayabilir) — büyük mağaza/yüksek trafik
// senaryosunda asıl çözüm Bölüm 10c/10b'deki "C" (bulk operations + arka
// plan iş) seçeneği, bu ileride eklenebilir.

import prisma from "../db.server";
import { fetchSalesSnapshot, logSnapshot, snapshotToPlain } from "./sales.server";
import { computeForecast } from "./forecast";
import { getReorderSettings } from "./shopSettings.server";
import { getVariantOverrides } from "./variantOverrides.server";
import { URGENT_DAYS } from "./inventory/constants";
import { recordAndResolvePredictions } from "./forecastAccuracy.server";
import fs from "node:fs/promises";
import path from "node:path";

const TTL_MS = 15 * 60 * 1000; // 15 dakika — ayarlanabilir, aşağıda not var
// 60 saniye. Eskiden 15 saniyeydi ve bu, büyük kataloglu mağazalarda
// "sürü etkisi" yaratıyordu: 3.000 varyantlı bir mağazada tam yenileme
// 15 saniyeyi aşabiliyor, süre dolunca kilit bayat sayılıp gelen her istek
// KENDİ yenilemesini başlatıyordu — aynı mağaza için üst üste birkaç tam
// Shopify taraması. Yenileme hata verdiğinde kilit zaten computeAndStore'un
// catch bloğunda serbest bırakılıyor, o yüzden bu süreyi uzatmanın tek
// maliyeti: sürecin sert şekilde öldüğü nadir durumda bayat veri 15 yerine
// 60 saniye gösterilir. Bu, gereksiz tekrar taramalardan çok daha iyi.
const LOCK_TIMEOUT_MS = 60 * 1000;

type Admin = Parameters<typeof fetchSalesSnapshot>[0];

// JSON.parse doğası gereği "any" döndürür, tip bilgisini otomatik taşımaz.
// computeForecast'ın gerçek dönüş tipinden türeterek önbellekten okunan
// veriye de aynı tipi geri kazandırıyoruz — böylece app._index.tsx'teki
// useLoaderData<typeof loader>() doğru tipleri görmeye devam ediyor.
type ForecastItem = ReturnType<typeof computeForecast>["forecasts"][number];

type ForecastGroups = {
    outOfStock: ForecastItem[];
    soonToStockout: ForecastItem[];
    // YENİ: sipariş noktası henüz uzak olan, rahat stoklu ürünler. Önceden
    // bunlar da soonToStockout'un içindeydi ve panelde "Azalıyor" diye
    // sayılıyordu — 6 ay stoğu olan bir ürün için yanıltıcı bir sinyal.
    healthy: ForecastItem[];
    insufficientData: ForecastItem[];
    deadStock: ForecastItem[];
    reorderAlerts: ForecastItem[];
    // YENİ (en çok satanlar): panel HEP sorunları gösteriyordu (tükendi/
    // azalıyor/ölü stok) — kullanıcı geri bildirimi: iyi giden ürünleri de
    // görmek, o yükselen satış grafiğine bakmak mağaza sahibi için gurur
    // verici bir an olabilir. Kategorilerden BAĞIMSIZ, çapraz bir liste —
    // bir ürün hem "soonToStockout" hem "topSellers" içinde olabilir
    // (hızlı satıp azalan bir ürün gibi), bu bilinçli.
    topSellers: ForecastItem[];
};

const TOP_SELLERS_LIMIT = 10;

function buildGroups(forecastResult: ReturnType<typeof computeForecast>): ForecastGroups {
    const visible = forecastResult.forecasts.filter((f) => f.status !== "DRAFT");
    const hiddenDraftCount = forecastResult.forecasts.length - visible.length;

    const outOfStock = visible.filter((f) => f.method === "already_out_of_stock");

    // Tahmin edilebilen ürünler İKİYE ayrılıyor. Eskiden hepsi tek bir
    // "soonToStockout" grubundaydı, yani panelde hepsi "Azalıyor" diye
    // sayılıyordu — gerçek bir mağazada 203 ürünün 111'inin stoğu 6 aydan
    // fazla yettiği halde "yakında sipariş verin" deniyordu. Üstteki uyarı
    // kutusu "27 ürün" derken kartın "203" demesi, mağaza sahibinin sayıya
    // olan güvenini doğrudan zedeliyordu.
    //
    // Ayrım ölçütü, uygulamanın kendi aciliyet tanımı: reorderByDays, yani
    // "siparişi vermem için kaç gün kaldı". <= 0 ise süre geçmiş, <=
    // URGENT_DAYS ise kapıda. Geri kalanı rahat.
    const forecastable = visible
        .filter((f) => f.method === "weighted_average")
        .sort((a, b) => (a.stockoutInDays ?? Infinity) - (b.stockoutInDays ?? Infinity));

    const needsAttentionSoon = (f: ForecastItem) =>
        f.reorderByDays != null && f.reorderByDays <= URGENT_DAYS;

    const soonToStockout = forecastable.filter(needsAttentionSoon);
    const healthy = forecastable.filter((f) => !needsAttentionSoon(f));

    const insufficientData = visible.filter((f) => f.method === "insufficient_data");
    const deadStock = visible.filter((f) => f.method === "no_recent_sales");

    // YENİ (tedarik süresi): eskiden sabit "14 gün kaldıysa acil" kuralı
    // vardı. Artık mağazanın kendi tedarik süresi ayarına göre hesaplanmış
    // reorderByDays kullanılıyor — <= 0 demek "sipariş için zaten geç
    // kalınmış" (yeni stok elinize ulaşana kadar mevcut stok yetmeyecek).
    // Ayar hiç yapılmamışsa reorderByDays zaten varsayılan 14 günle
    // hesaplanmış oluyor (bkz. shopSettings.server.ts), yani eski davranış
    // birebir korunuyor.
    const reorderAlerts = [
        ...outOfStock,
        ...soonToStockout.filter((f) => f.reorderByDays != null && f.reorderByDays <= 0),
    ];

    // YENİ (kullanıcı düzeltmesi): "gurur tablosu" değil, satış paneli —
    // sadece ŞU AN satışta olan (stokta > 0) ürünler aday. Stokta olmayan
    // bir ürünü "en çok satan" diye övmek kafa karıştırır ve pratik bir
    // değeri yok (merchant zaten "tükendi" listesinde onu görüyor).
    const topSellers = visible
        .filter((f) => f.available > 0 && f.dailyRate != null && f.dailyRate > 0)
        .sort((a, b) => (b.dailyRate ?? 0) - (a.dailyRate ?? 0))
        .slice(0, TOP_SELLERS_LIMIT);

    console.log(
        `\n[Önbellek — YENİ HESAPLAMA] Görünür: ${visible.length} (${hiddenDraftCount} draft gizlendi). ` +
        `Zaten tükenen: ${outOfStock.length}, yakında tükenecek: ${soonToStockout.length}, ` +
        `ölü stok adayı: ${deadStock.length}, veri yetersiz: ${insufficientData.length}, ` +
        `sipariş uyarısı: ${reorderAlerts.length}, en çok satan: ${topSellers.length}.`,
    );

    return { outOfStock, soonToStockout, healthy, insufficientData, deadStock, reorderAlerts, topSellers };
}


// Önbellekten okunan JSON, ŞEMA DEĞİŞİKLİĞİNDEN ÖNCE yazılmış olabilir.
// Somut olay: "healthy" grubu sonradan eklendi; yeni kod dağıtıldığında
// önbelleği dolu olan her mağazada groups.healthy `undefined` gelir ve
// paneli render eden kod (splitSnoozed) anında patlardı. Önbellek TTL'i
// dolana kadar o mağazalar uygulamayı hiç açamazdı.
// Bu yüzden önbellekten gelen her nesne, okuma anında beklenen şekle
// normalize ediliyor — eksik diziler boş dizi olur, veri bir sonraki
// yenilemede kendiliğinden doğru dolar.
function normalizeGroups(raw: unknown): ForecastGroups {
    const g = (raw ?? {}) as Partial<Record<keyof ForecastGroups, ForecastItem[]>>;
    const list = (v: ForecastItem[] | undefined) => (Array.isArray(v) ? v : []);
    return {
        outOfStock: list(g.outOfStock),
        soonToStockout: list(g.soonToStockout),
        healthy: list(g.healthy),
        insufficientData: list(g.insufficientData),
        deadStock: list(g.deadStock),
        reorderAlerts: list(g.reorderAlerts),
        topSellers: list(g.topSellers),
    };
}

async function computeAndStore(shop: string, admin: Admin) {
    // Hesaplama patlarsa geri dönebilmek için ÖNCEKİ (bayat ama kullanılabilir)
    // veriyi kilitten önce okuyoruz — bkz. aşağıdaki catch bloğu.
    const previous = await prisma.forecastSnapshot.findUnique({ where: { shop } });
    const usablePrevious = previous && previous.data !== "{}" ? previous : null;

    // Kilidi al: başka bir istek aynı anda hesaplamaya girmesin.
    await prisma.forecastSnapshot.upsert({
        where: { shop },
        update: { status: "computing", lockedAt: new Date() },
        create: { shop, data: "{}", status: "computing", lockedAt: new Date() },
    });

    try {
        const t0 = Date.now();
        const snapshot = await fetchSalesSnapshot(admin);
        logSnapshot(snapshot, Date.now() - t0);

        // snapshot.json SADECE geliştirme ortamında yazılıyor. Üretimde bu
        // yazım üç ayrı soruna yol açıyordu: (1) tek, süreç-geneli bir dosya
        // olduğu için çok mağazalı kurulumda bir mağazanın verisi diğerinin
        // üstüne yazılıyordu, (2) her yenilemede megabaytlarca gereksiz disk
        // yazımı, (3) salt-okunur dosya sistemi olan barındırma
        // ortamlarında (yaygın) HATA FIRLATIP tüm yenilemeyi çökertiyordu.
        // Hata ayıklama kolaylığı yerelde korunuyor; yazım başarısız olursa
        // yenileme yine de devam ediyor.
        if (process.env.NODE_ENV !== "production") {
            try {
                const snapshotPath = path.join(process.cwd(), "snapshot.json");
                await fs.writeFile(snapshotPath, JSON.stringify(snapshotToPlain(snapshot), null, 2));
            } catch (writeError) {
                console.warn("[forecast] snapshot.json yazılamadı (önemsiz, devam ediliyor):", writeError);
            }
        }

        // YENİ (tedarik süresi): mağazanın kendi ayarı (varsa) hesaplamaya dahil
        // ediliyor. Ayar hiç yapılmamışsa varsayılanlara düşülüyor (bkz.
        // shopSettings.server.ts) — mevcut mağazaların davranışı değişmiyor.
        const reorderSettings = await getReorderSettings(shop);
        // YENİ (satır içi tedarik süresi): mağaza varsayılanının üstüne, varsa
        // ürüne özel override'lar uygulanıyor (bkz. variantOverrides.server.ts).
        const overrides = await getVariantOverrides(shop);
        const forecastResult = computeForecast(snapshot, new Date(), reorderSettings, overrides);
        const groups = buildGroups(forecastResult);

        // Tahmin karnesi: kendi tahminlerimizi sonradan sinamak icin kaydet
        // ve ufku dolanlari gerceklesenle kapat. Kendi icinde try/catch'li —
        // karne bozulursa panel etkilenmez (bkz. forecastAccuracy.server.ts).
        await recordAndResolvePredictions(shop, forecastResult.forecasts);

        const computedAt = new Date();
        await prisma.forecastSnapshot.upsert({
            where: { shop },
            update: { data: JSON.stringify(groups), status: "ready", computedAt, lockedAt: null },
            create: { shop, data: JSON.stringify(groups), status: "ready", computedAt, lockedAt: null },
        });

        return { groups, computedAt, fromCache: false as const };
    } catch (error) {
        // Hesaplama patladı (Shopify kesintisi, throttling, ağ hatası...).
        // Önceden kilit "computing" olarak KALIYOR ve hiç sıfırlanmıyordu:
        // 15 saniyelik kilit süresi dolduktan sonra her istek yeniden
        // hesaplamayı deneyip yine patlıyor, mağaza sahibi elimizde dünün
        // gayet kullanılabilir rakamları dururken hata ekranı görüyordu.
        // Artık kilit bırakılıyor ve varsa bayat veri dürüstçe (eski
        // "son güncelleme" tarihiyle) gösteriliyor.
        if (usablePrevious) {
            await prisma.forecastSnapshot.update({
                where: { shop },
                data: { status: "ready", lockedAt: null },
            });
            console.error("[forecast] Yenileme başarısız, bayat veri gösteriliyor:", error);
            return {
                groups: normalizeGroups(JSON.parse(usablePrevious.data)),
                computedAt: usablePrevious.computedAt,
                fromCache: true as const,
            };
        }
        // Hiç veri yok (ilk kurulum) — gösterilecek bir şey olmadığı için
        // hatayı yukarı bırakıyoruz, ama kilidi mutlaka serbest bırakıyoruz.
        await prisma.forecastSnapshot
            .update({ where: { shop }, data: { status: "error", lockedAt: null } })
            .catch(() => { });
        throw error;
    }
}

export async function getForecastGroups(
    shop: string,
    admin: Admin,
    options?: { forceRefresh?: boolean },
): Promise<{ groups: ForecastGroups; computedAt: Date; fromCache: boolean }> {
    const existing = await prisma.forecastSnapshot.findUnique({ where: { shop } });

    const isFresh =
        !!existing &&
        existing.status === "ready" &&
        Date.now() - existing.computedAt.getTime() < TTL_MS;

    if (existing && isFresh && !options?.forceRefresh) {
        return {
            groups: normalizeGroups(JSON.parse(existing.data)),
            computedAt: existing.computedAt,
            fromCache: true,
        };
    }

    const lockIsActive =
        !!existing &&
        existing.status === "computing" &&
        !!existing.lockedAt &&
        Date.now() - existing.lockedAt.getTime() < LOCK_TIMEOUT_MS;

    // Başka bir istek şu an hesaplıyor ve elimizde (bayat da olsa) gerçek veri
    // varsa, yeni bir hesaplamaya girmek yerine onu döndürüyoruz. Hiç veri
    // yoksa (ilk kurulum, yarış anı) hesaplamayı biz üstleniriz — nadir,
    // kabul edilebilir bir durum.
    if (lockIsActive && existing && existing.data !== "{}") {
        return {
            groups: normalizeGroups(JSON.parse(existing.data)),
            computedAt: existing.computedAt,
            fromCache: true,
        };
    }

    return computeAndStore(shop, admin);
}