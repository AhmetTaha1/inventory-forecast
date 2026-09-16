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

// --- YENİ (Adım 7): v7/v30/v90 ağırlıklı hız hesabı ---
const WINDOW_WEIGHTS: { days: number; weight: number }[] = [
    { days: 7, weight: 0.2 },
    { days: 30, weight: 0.5 },
    { days: 90, weight: 0.3 },
];

// excludeOneOffDay: true ise en yoğun gün hız hesabından tamamen çıkarılır (Hydrogen kuralı)
function computeDailyRate(sales: VariantSales | undefined, now: Date, excludeOneOffDay: boolean): number | null {
    if (!sales) return null;
    let entries = Object.entries(sales.byDay);
    if (entries.length === 0) return null;

    if (excludeOneOffDay) {
        let maxDay = entries[0];
        for (const e of entries) if (e[1] > maxDay[1]) maxDay = e;
        entries = entries.filter(([day]) => day !== maxDay[0]);
    }
    if (entries.length === 0) return null; // tüm satış tek bir one-off güne aitti

    const firstDay = entries.map(([d]) => d).sort()[0];
    const dayspan = daysSince(firstDay, now) + 1; // ilk satış günü dahil, bugüne kadar geçen gün sayısı

    let weightedSum = 0;
    for (const { days: windowSize, weight } of WINDOW_WEIGHTS) {
        // Pencere, elimizdeki gerçek veri süresinden uzun olamaz (Compare at Price: 26 günlük veriyi 90'a bölme)
        const effectiveWindow = Math.max(1, Math.min(windowSize, dayspan));
        const windowSum = entries.reduce((sum, [day, qty]) => {
            const age = daysSince(day, now);
            return age < windowSize ? sum + qty : sum;
        }, 0);
        weightedSum += (windowSum / effectiveWindow) * weight;
    }
    return weightedSum; // ağırlıklar zaten toplamda 1.0
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

        // YENİ (Adım 7): üç durum sırayla kontrol edilir.
        let dailyRate: number | null = null;
        let stockoutInDays: number | null = null;
        let method: string;

        if (v.available === 0) {
            // Stok zaten 0. Sıfıra bölme yok, "zaten bitti" durumu net.
            method = "already_out_of_stock";
            stockoutInDays = 0;
        } else if (confidence === "insufficient") {
            // Veri yetersiz (Hydrogen dahil). Dürüstçe null bırakılıyor, hesap denenmiyor.
            method = "insufficient_data";
        } else {
            dailyRate = computeDailyRate(sales, now, oneOffDetected);
            if (dailyRate && dailyRate > 0) {
                stockoutInDays = Math.round((v.available / dailyRate) * 10) / 10;
                method = "weighted_average";
            } else {
                // Videographer tuzağı: veri geçmişi yeterli ama son dönemde hiç satış yok.
                // "Hızlı satıyor" yalanı yerine dürüst sinyal.
                dailyRate = 0;
                method = "no_recent_sales";
            }
        }

        forecasts.push({
            variantId: v.variantId,
            variantTitle: v.variantTitle,
            productId: v.productId,
            productTitle: v.productTitle,
            status: v.status,
            confidence,
            oneOffDetected,
            stockoutInDays,
            dailyRate,
            available: v.available,
            method,
        });
    }

    return { forecasts, excluded };
}