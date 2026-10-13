// app/lib/forecastAccuracy.server.ts
//
// Tahmin karnesi: kendi tahminlerimizi sonradan gerçekleşenle karşılaştırıp
// mağaza sahibine dürüstçe gösteriyoruz. Kategorinin en büyük güven sorununa
// (rakip yorumlarındaki "kara kutu" şikâyeti) doğrudan cevap — hiçbir rakip
// kendi isabetini ölçmüyor.
//
// Ölçülen şey satış HIZI tahmini, tükenme tarihi değil (gerekçe:
// prisma/schema.prisma'daki ForecastAccuracy notu).

import prisma from "../db.server";
import type { VariantForecast } from "./forecast";

// Tahminin ne kadar sonra sınanacağı. 14 gün: bir mağazanın satış
// dalgalanmasını yumuşatacak kadar uzun, mağaza sahibinin ilgisini
// kaybetmeyeceği kadar kısa.
const HORIZON_DAYS = 14;

// Karnede gösterilecek azami geçmiş. Daha eskisi hem alakasız hem de
// tabloyu gereksiz büyütüyor.
const RETENTION_DAYS = 120;

// Çok yavaş satan ürünlerde yüzdesel sapma anlamsız şişiyor (0.02/gün
// tahmin, 0.04 gerçek = %100 sapma ama pratikte 14 günde yarım adet fark).
// Karne sadece anlamlı hacimli ürünlerden hesaplanıyor.
const MIN_RATE_FOR_SCORING = 0.1;

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function unitsSoldBetween(salesByDay: Record<string, number> | null | undefined, from: Date, to: Date): number {
    if (!salesByDay) return 0;
    const fromKey = dayKey(from);
    const toKey = dayKey(to);
    let sum = 0;
    for (const [day, qty] of Object.entries(salesByDay)) {
        if (day >= fromKey && day < toKey) sum += qty;
    }
    return sum;
}

/**
 * Her forecast hesaplamasından sonra çağrılır. İki iş yapar:
 *  1. Ufku dolmuş açık tahminleri gerçekleşen satışla kapatır.
 *  2. Açık tahmini olmayan varyantlar için yeni tahmin açar.
 *
 * Hata vermemesi KRİTİK: bu, panelin yüklenmesini bloke eden bir yolda
 * çağrılıyor. Karne ikincil bir özellik — bozulursa sessizce atlanmalı,
 * mağaza sahibinin stok panelini düşürmemeli.
 */
export async function recordAndResolvePredictions(
    shop: string,
    forecasts: VariantForecast[],
    now: Date = new Date(),
): Promise<void> {
    try {
        const byVariant = new Map(forecasts.map((f) => [f.variantId, f]));

        // --- 1. Ufku dolan açık tahminleri kapat ---------------------------
        const open = await prisma.forecastAccuracy.findMany({
            where: { shop, checkedAt: null },
        });

        for (const row of open) {
            const due = new Date(row.predictedAt.getTime() + row.horizonDays * DAY_MS);
            if (due > now) continue; // ufuk henüz dolmadı

            const f = byVariant.get(row.variantId);
            // Ürün silinmiş/arşivlenmişse ölçemeyiz — satırı temizliyoruz ki
            // sonsuza kadar "açık" kalmasın.
            if (!f) {
                await prisma.forecastAccuracy.delete({ where: { id: row.id } }).catch(() => { });
                continue;
            }

            const sold = unitsSoldBetween(f.salesByDay, row.predictedAt, due);
            await prisma.forecastAccuracy.update({
                where: { id: row.id },
                data: { actualDailyRate: sold / row.horizonDays, checkedAt: now },
            });
        }

        // --- 2. Açık tahmini olmayan varyantlar için yeni tahmin aç --------
        const stillOpen = new Set(
            (await prisma.forecastAccuracy.findMany({
                where: { shop, checkedAt: null },
                select: { variantId: true },
            })).map((r) => r.variantId),
        );

        const newRows = forecasts
            .filter((f) => f.dailyRate != null && f.dailyRate >= MIN_RATE_FOR_SCORING)
            .filter((f) => !stillOpen.has(f.variantId))
            .map((f) => ({
                shop,
                variantId: f.variantId,
                productTitle: f.productTitle,
                predictedAt: now,
                horizonDays: HORIZON_DAYS,
                predictedDailyRate: f.dailyRate as number,
            }));

        if (newRows.length > 0) {
            await prisma.forecastAccuracy.createMany({ data: newRows });
        }

        // --- 3. Eski kayıtları buda ---------------------------------------
        await prisma.forecastAccuracy.deleteMany({
            where: { shop, predictedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) } },
        });
    } catch (error) {
        console.error("[accuracy] Tahmin karnesi güncellenemedi (panel etkilenmedi):", error);
    }
}

export type AccuracyScorecard = {
    checkedCount: number;
    // Ölçülen tahminlerin yüzde kaçı gerçeğin ±%25'i içindeydi.
    withinQuarterPct: number;
    // Medyan mutlak yüzdesel sapma — ortalama yerine medyan, çünkü tek bir
    // uç örnek (kampanya patlaması) ortalamayı yanıltıcı biçimde bozuyor.
    medianErrorPct: number;
    horizonDays: number;
    examples: { productTitle: string; predicted: number; actual: number }[];
};

/**
 * Panelde gösterilecek özet. Hiç ölçülmüş tahmin yoksa null döner —
 * çağıran taraf kartı hiç göstermez (boş bir karne güven vermez).
 */
export async function getAccuracyScorecard(shop: string): Promise<AccuracyScorecard | null> {
    try {
        const rows = await prisma.forecastAccuracy.findMany({
            where: { shop, checkedAt: { not: null }, actualDailyRate: { not: null } },
            orderBy: { checkedAt: "desc" },
            take: 300,
        });
        if (rows.length === 0) return null;

        const errors: number[] = [];
        for (const r of rows) {
            const predicted = r.predictedDailyRate;
            const actual = r.actualDailyRate as number;
            // Payda olarak ikisinin büyüğü: hem sıfıra bölmeyi engelliyor hem
            // de "0.1 dedik 0 oldu" ile "0 dedik 0.1 oldu" simetrik sayılıyor.
            const denom = Math.max(predicted, actual);
            if (denom <= 0) continue;
            errors.push(Math.abs(predicted - actual) / denom);
        }
        if (errors.length === 0) return null;

        const sorted = [...errors].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const within = errors.filter((e) => e <= 0.25).length;

        return {
            checkedCount: errors.length,
            withinQuarterPct: Math.round((within / errors.length) * 100),
            medianErrorPct: Math.round(median * 100),
            horizonDays: HORIZON_DAYS,
            examples: rows.slice(0, 3).map((r) => ({
                productTitle: r.productTitle,
                predicted: Math.round(r.predictedDailyRate * 10) / 10,
                actual: Math.round((r.actualDailyRate as number) * 10) / 10,
            })),
        };
    } catch (error) {
        console.error("[accuracy] Karne okunamadı:", error);
        return null;
    }
}
