// app/lib/forecast.ts
// Faz 2 / Adım 5: Tükenme tahmini motoru.
// SAF FONKSİYON. Girdi bir SalesSnapshot, çıktı varyant başına tahmin.
// API çağrısı YOK — bu dosya Shopify'sız test edilebilir olmalı.

import type { SalesSnapshot, VariantInfo, VariantSales } from "./sales.server";

// --- Güven seviyesi (Bölüm 15, Karar 3) ---
export type Confidence = "normal" | "low" | "insufficient";

// --- Elenme sebebi: motora hiç girmeyen varyantlar için ---
export type ExclusionReason = "gift_card" | "archived" | "not_tracked";

export type VariantForecast = {
    variantId: string;
    variantTitle: string;
    productId: string;
    productTitle: string;
    status: string; // ACTIVE | DRAFT | ARCHIVED (ARCHIVED buraya hiç gelmez, elenir)
    confidence: Confidence;
    oneOffDetected: boolean; // Hydrogen tuzağı: tek seferlik büyük sipariş tespit edildiyse
    stockoutInDays: number | null; // null = hesaplanamadı (insufficient veya stok zaten 0)
    dailyRate: number | null; // günlük satış hızı (birim/gün), one-off ayıklandıktan sonra
    available: number;
    method: string; // ör. "weighted_average" — kullanıcıya dürüstçe gösterilecek (Bölüm 15)
};

export type ForecastResult = {
    forecasts: VariantForecast[];
    excluded: {
        variantId: string;
        variantTitle: string;
        productTitle: string;
        reason: ExclusionReason;
    }[];
};

// --- Eleme kuralı: bu varyant motora hiç girmemeli mi? ---
function exclusionReason(v: VariantInfo): ExclusionReason | null {
    if (v.isGiftCard) return "gift_card";
    if (v.status === "ARCHIVED") return "archived";
    if (!v.tracked) return "not_tracked";
    return null;
}

// --- YENİ (Adım 6): "YYYY-MM-DD" formatındaki bir günden, referans tarihe kaç gün geçtiğini hesaplar ---
function daysSince(dayStr: string, now: Date): number {
    const d = new Date(dayStr + "T00:00:00Z");
    return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

// --- YENİ (Adım 6): Bölüm 15 Karar 3'teki confidence kuralı ---
// normal: ilk satış >= 30 gün önce VE >= 5 farklı satış günü
// low:    ilk satış < 30 gün OR 2-4 satış günü
// insufficient: 0-1 satış günü
function computeConfidence(sales: VariantSales | undefined, now: Date): Confidence {
    if (!sales) return "insufficient";
    const days = Object.keys(sales.byDay);
    if (days.length <= 1) return "insufficient";

    const firstDay = days.sort()[0];
    const sinceFirst = daysSince(firstDay, now);
    if (sinceFirst >= 30 && days.length >= 5) return "normal";
    return "low";
}

// --- YENİ (Adım 6): Hydrogen tuzağı. Tek bir günün payı toplamın yarısından fazlaysa
// VE satış günü sayısı azsa (<=3), tek seferlik büyük sipariş olarak işaretlenir. ---
const ONE_OFF_SHARE_THRESHOLD = 0.5;
const ONE_OFF_MAX_SALE_DAYS = 3;

function detectOneOff(sales: VariantSales | undefined): boolean {
    if (!sales || sales.units === 0) return false;
    const dayEntries = Object.entries(sales.byDay);
    if (dayEntries.length === 0 || dayEntries.length > ONE_OFF_MAX_SALE_DAYS) return false;

    const maxDayUnits = Math.max(...dayEntries.map(([, qty]) => qty));
    return maxDayUnits / sales.units > ONE_OFF_SHARE_THRESHOLD;
}

// --- Ana giriş noktası. `now` test edilebilirlik için parametre — vermezsen bugünün tarihi kullanılır. ---
export function computeForecast(snapshot: SalesSnapshot, now: Date = new Date()): ForecastResult {
    const forecasts: VariantForecast[] = [];
    const excluded: ForecastResult["excluded"] = [];

    for (const v of snapshot.variants.values()) {
        const reason = exclusionReason(v);
        if (reason) {
            excluded.push({
                variantId: v.variantId,
                variantTitle: v.variantTitle,
                productTitle: v.productTitle,
                reason,
            });
            continue;
        }

        const sales: VariantSales | undefined = snapshot.sales.get(v.variantId);
        const confidence = computeConfidence(sales, now);
        const oneOffDetected = detectOneOff(sales);

        // GEÇİCİ: dailyRate ve stockoutInDays henüz hesaplanmıyor. Adım 7'de eklenecek
        // (v7/v30/v90 ağırlıklı hız + one-off ayıklama + sıfır stok koruması).
        forecasts.push({
            variantId: v.variantId,
            variantTitle: v.variantTitle,
            productId: v.productId,
            productTitle: v.productTitle,
            status: v.status,
            confidence,
            oneOffDetected,
            stockoutInDays: null, // GEÇİCİ, Adım 7
            dailyRate: null, // GEÇİCİ, Adım 7
            available: v.available,
            method: "not_implemented", // GEÇİCİ, Adım 7
        });
    }

    return { forecasts, excluded };
}