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
import fs from "node:fs/promises";
import path from "node:path";

const TTL_MS = 15 * 60 * 1000; // 15 dakika — ayarlanabilir, aşağıda not var
const LOCK_TIMEOUT_MS = 15 * 1000; // 15 saniye — bu süreden eski "computing" kilidi bayat sayılır

type Admin = Parameters<typeof fetchSalesSnapshot>[0];

// JSON.parse doğası gereği "any" döndürür, tip bilgisini otomatik taşımaz.
// computeForecast'ın gerçek dönüş tipinden türeterek önbellekten okunan
// veriye de aynı tipi geri kazandırıyoruz — böylece app._index.tsx'teki
// useLoaderData<typeof loader>() doğru tipleri görmeye devam ediyor.
type ForecastItem = ReturnType<typeof computeForecast>["forecasts"][number];

type ForecastGroups = {
    outOfStock: ForecastItem[];
    soonToStockout: ForecastItem[];
    insufficientData: ForecastItem[];
    deadStock: ForecastItem[];
    reorderAlerts: ForecastItem[];
};

function buildGroups(forecastResult: ReturnType<typeof computeForecast>): ForecastGroups {
    const visible = forecastResult.forecasts.filter((f) => f.status !== "DRAFT");
    const hiddenDraftCount = forecastResult.forecasts.length - visible.length;

    const outOfStock = visible.filter((f) => f.method === "already_out_of_stock");

    const soonToStockout = visible
        .filter((f) => f.method === "weighted_average")
        .sort((a, b) => (a.stockoutInDays ?? Infinity) - (b.stockoutInDays ?? Infinity));

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

    console.log(
        `\n[Önbellek — YENİ HESAPLAMA] Görünür: ${visible.length} (${hiddenDraftCount} draft gizlendi). ` +
        `Zaten tükenen: ${outOfStock.length}, yakında tükenecek: ${soonToStockout.length}, ` +
        `ölü stok adayı: ${deadStock.length}, veri yetersiz: ${insufficientData.length}, ` +
        `sipariş uyarısı: ${reorderAlerts.length}.`,
    );

    return { outOfStock, soonToStockout, insufficientData, deadStock, reorderAlerts };
}

async function computeAndStore(shop: string, admin: Admin) {
    // Kilidi al: başka bir istek aynı anda hesaplamaya girmesin.
    await prisma.forecastSnapshot.upsert({
        where: { shop },
        update: { status: "computing", lockedAt: new Date() },
        create: { shop, data: "{}", status: "computing", lockedAt: new Date() },
    });

    const t0 = Date.now();
    const snapshot = await fetchSalesSnapshot(admin);
    logSnapshot(snapshot, Date.now() - t0);

    // snapshot.json: artık sadece gerçek hesaplama olduğunda yazılıyor,
    // önbellekten dönen isteklerde değil (Adım 3'ten beri duran özellik).
    const snapshotPath = path.join(process.cwd(), "snapshot.json");
    await fs.writeFile(snapshotPath, JSON.stringify(snapshotToPlain(snapshot), null, 2));

    // YENİ (tedarik süresi): mağazanın kendi ayarı (varsa) hesaplamaya dahil
    // ediliyor. Ayar hiç yapılmamışsa varsayılanlara düşülüyor (bkz.
    // shopSettings.server.ts) — mevcut mağazaların davranışı değişmiyor.
    const reorderSettings = await getReorderSettings(shop);
    const forecastResult = computeForecast(snapshot, new Date(), reorderSettings);
    const groups = buildGroups(forecastResult);

    const computedAt = new Date();
    await prisma.forecastSnapshot.upsert({
        where: { shop },
        update: { data: JSON.stringify(groups), status: "ready", computedAt, lockedAt: null },
        create: { shop, data: JSON.stringify(groups), status: "ready", computedAt, lockedAt: null },
    });

    return { groups, computedAt, fromCache: false as const };
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
            groups: JSON.parse(existing.data) as ForecastGroups,
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
            groups: JSON.parse(existing.data) as ForecastGroups,
            computedAt: existing.computedAt,
            fromCache: true,
        };
    }

    return computeAndStore(shop, admin);
}