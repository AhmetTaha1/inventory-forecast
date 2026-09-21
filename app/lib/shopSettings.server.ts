// app/lib/shopSettings.server.ts
//
// Mağaza bazlı "sipariş ayarları": tedarik süresi (lead time) + sipariş
// kapsama günü (coverage days). Sipariş sihirbazı (app/routes/app.settings.tsx)
// bunları kaydediyor, forecastCache.server.ts computeForecast()'a geçiriyor.
//
// onboardedAt: sihirbaz İLK kez tamamlandığında set edilir, sonraki
// düzenlemelerde DEĞİŞMEZ — panelde "kurulumu tamamla" hatırlatmasının bir
// daha çıkmaması için (bkz. app._index.tsx).

import prisma from "../db.server";
import { DEFAULT_COVERAGE_DAYS, DEFAULT_LEAD_TIME_DAYS, type ReorderSettings } from "./forecast";

export type ShopSettings = ReorderSettings & {
    onboardedAt: Date | null;
};

// Mantıklı bir aralık dışına çıkan değerleri sessizce kırpıyoruz — ne 0/negatif
// bir tedarik süresi ne de bir yıldan uzun bir değer gerçekçi, formdan gelen
// veriye asla çıplak güvenmiyoruz.
const MIN_DAYS = 1;
const MAX_DAYS = 365;

export function clampDays(value: number): number {
    if (!Number.isFinite(value)) return MIN_DAYS;
    return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(value)));
}

export async function getShopSettings(shop: string): Promise<ShopSettings | null> {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    if (!row) return null;
    return {
        leadTimeDays: row.leadTimeDays,
        coverageDays: row.coverageDays,
        onboardedAt: row.onboardedAt,
    };
}

// forecastCache.server.ts'in ayar hiç yapılmamış mağazalar için de her zaman
// bir ReorderSettings'e ihtiyacı var — burada varsayılanlara düşülüyor.
export async function getReorderSettings(shop: string): Promise<ReorderSettings> {
    const settings = await getShopSettings(shop);
    return {
        leadTimeDays: settings?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS,
        coverageDays: settings?.coverageDays ?? DEFAULT_COVERAGE_DAYS,
    };
}

export async function saveShopSettings(
    shop: string,
    input: { leadTimeDays: number; coverageDays: number },
): Promise<void> {
    const leadTimeDays = clampDays(input.leadTimeDays);
    const coverageDays = clampDays(input.coverageDays);

    // "update" onboardedAt'a hiç dokunmuyor — satır zaten varsa (yani daha
    // önce en az bir kez kaydedilmişse) tamamlanma zamanı olduğu gibi kalır,
    // sadece ilk oluşturmada set edilir. Bu yüzden ekstra bir kontrole gerek
    // yok: onboardedAt satır var olduğu sürece asla geriye dönüp boşalmaz.
    await prisma.shopSettings.upsert({
        where: { shop },
        update: { leadTimeDays, coverageDays },
        create: { shop, leadTimeDays, coverageDays, onboardedAt: new Date() },
    });
}

// --- Karşılama turu (WelcomeTour) — sadece ilk açılışta gösterilir ---
// Bilerek localStorage DEĞİL: tarayıcı belleği temizlenirse ya da farklı
// bir cihazdan/kullanıcıdan girilirse tur tekrar tekrar çıkardı. Sunucu
// tarafında kalıcı olduğu için gerçekten "bir kez" garantisi veriyor.

export async function hasTourBeenSeen(shop: string): Promise<boolean> {
    const row = await prisma.shopSettings.findUnique({ where: { shop } });
    return row?.tourSeenAt != null;
}

export async function markTourSeen(shop: string): Promise<void> {
    // Satır henüz yoksa (mağaza hiç sipariş ayarı yapmamış) burada
    // oluşturuluyor — leadTimeDays/coverageDays şemadaki varsayılanlara
    // düşer, onboardedAt null kalır (bu iki kavram birbirinden bağımsız).
    await prisma.shopSettings.upsert({
        where: { shop },
        update: { tourSeenAt: new Date() },
        create: { shop, tourSeenAt: new Date() },
    });
}
