// app/lib/snooze.server.ts
//
// "Ertele" (snooze): bir varyantı belirli bir süre (ya da süresiz) uyarı
// listelerinden çıkarır. Kalıcı bir "mute" değil — mağaza sahibi geçmişte
// tamamen bir ürünü susturup unutabiliyordu, süreli erteleme bu riski
// ortadan kaldırıyor (rakip araştırmasından gelen karar).
//
// Bilinçli mimari kararı: erteleme, ForecastSnapshot önbelleğinin İÇİNE
// gömülmüyor — her 15 dakikada bir yeniden hesaplanan o blob'un dışında,
// ayrı ve küçük bir tabloda tutuluyor. Böylece bir ürünü ertelemek/geri
// almak PAHALI bir yeniden hesaplamayı (Shopify'dan tüm veriyi çekmeyi)
// tetiklemiyor — sadece loader'da hızlı bir filtre adımı (bkz. app._index.tsx).

import prisma from "../db.server";

export async function getActiveSnoozes(shop: string): Promise<Map<string, Date | null>> {
    const rows = await prisma.snoozedVariant.findMany({ where: { shop } });
    const now = Date.now();
    const active = new Map<string, Date | null>();
    for (const row of rows) {
        // snoozeUntil null = süresiz; dolu ve geçmişte kalmışsa artık aktif değil.
        if (row.snoozeUntil == null || row.snoozeUntil.getTime() > now) {
            active.set(row.variantId, row.snoozeUntil);
        }
    }
    return active;
}

export async function snoozeVariant(shop: string, variantId: string, days: number | null): Promise<void> {
    const snoozeUntil = days == null ? null : new Date(Date.now() + days * 86_400_000);
    await prisma.snoozedVariant.upsert({
        where: { shop_variantId: { shop, variantId } },
        update: { snoozeUntil },
        create: { shop, variantId, snoozeUntil },
    });
}

export async function unsnoozeVariant(shop: string, variantId: string): Promise<void> {
    await prisma.snoozedVariant.deleteMany({ where: { shop, variantId } });
}
