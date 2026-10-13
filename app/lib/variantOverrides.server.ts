// app/lib/variantOverrides.server.ts
//
// Satır içi tedarik süresi override'ı (bkz. ifh_competitor_ideas memory:
// "inline, per-row editable lead time... pair with a global/default
// setting"). ShopSettings'teki mağaza-geneli varsayılan KALIYOR; bu tablo
// sadece TEK bir varyant için o varsayılanı ezen bir istisna tutuyor.

import prisma from "../db.server";
import { clampDays } from "./shopSettings.server";
import type { ReorderSettings } from "./forecast";

// forecastCache.server.ts'in computeForecast()'a geçireceği şekil: her
// varyant için (varsa) leadTimeDays/coverageDays override'ı.
export async function getVariantOverrides(shop: string): Promise<Map<string, Partial<ReorderSettings>>> {
    const rows = await prisma.variantLeadTimeOverride.findMany({ where: { shop } });
    const map = new Map<string, Partial<ReorderSettings>>();
    for (const row of rows) {
        const partial: Partial<ReorderSettings> = {};
        if (row.leadTimeDays != null) partial.leadTimeDays = row.leadTimeDays;
        if (row.coverageDays != null) partial.coverageDays = row.coverageDays;
        if (Object.keys(partial).length > 0) map.set(row.variantId, partial);
    }
    return map;
}

// leadTimeDays === null -> override'ı kaldır (mağaza varsayılanına dön).
// Şu an sadece lead time düzenlenebiliyor (coverage için ayrı bir UI yok,
// ama servis/tablo ikisini de destekliyor — ileride coverage inline edit
// eklenirse şema değişikliği gerekmez).
export async function setVariantLeadTimeOverride(
    shop: string,
    variantId: string,
    leadTimeDays: number | null,
): Promise<void> {
    if (leadTimeDays == null) {
        const existing = await prisma.variantLeadTimeOverride.findUnique({ where: { shop_variantId: { shop, variantId } } });
        if (!existing) return;
        if (existing.coverageDays == null) {
            // İki alan da boşaldı — satırı tamamen silmek daha temiz,
            // getVariantOverrides()'ın her sorguda gereksiz boş kayıt
            // taşımasını önlüyor.
            await prisma.variantLeadTimeOverride.delete({ where: { shop_variantId: { shop, variantId } } });
        } else {
            await prisma.variantLeadTimeOverride.update({
                where: { shop_variantId: { shop, variantId } },
                data: { leadTimeDays: null },
            });
        }
        return;
    }

    const clamped = clampDays(leadTimeDays);
    await prisma.variantLeadTimeOverride.upsert({
        where: { shop_variantId: { shop, variantId } },
        update: { leadTimeDays: clamped },
        create: { shop, variantId, leadTimeDays: clamped },
    });
}
