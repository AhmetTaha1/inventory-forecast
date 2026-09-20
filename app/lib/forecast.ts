// app/lib/forecast.ts
// Faz 2 / Adım 5: Tükenme tahmini motoru.
// SAF FONKSİYON. Girdi bir SalesSnapshot, çıktı varyant başına tahmin.
// API çağrısı YOK — bu dosya Shopify'sız test edilebilir olmalı.

import type { SalesSnapshot, VariantInfo, VariantSales } from "./sales.server";

// --- Güven seviyesi (Bölüm 15, Karar 3) ---
export type Confidence = "normal" | "low" | "insufficient";

// --- Trend oku: son 7 gün, önceki 7 güne göre nasıl? ---
export type Trend = "up" | "down" | "flat";

// --- YENİ: Tedarik süresi + sipariş kapsama günü ---
// leadTimeDays: sipariş verdikten kaç gün sonra yeni stok elinize ulaşıyor.
// coverageDays: yeni stok geldiğinde, KAÇ GÜNLÜK talebi daha karşılamak
// istediğiniz (güvenlik payı gibi düşünülebilir).
// Varsayılanlar, ShopSettings hiç ayarlanmamış mağazalar için önceki
// sabit davranışı (REORDER_ALERT_DAYS = 14) birebir koruyor — hiçbir
// mevcut mağazanın davranışı bu özellik eklendiği için değişmiyor.
export const DEFAULT_LEAD_TIME_DAYS = 14;
export const DEFAULT_COVERAGE_DAYS = 30;

export type ReorderSettings = {
    leadTimeDays: number;
    coverageDays: number;
};

const DEFAULT_REORDER_SETTINGS: ReorderSettings = {
    leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    coverageDays: DEFAULT_COVERAGE_DAYS,
};

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
    imageUrl: string | null; // <-- YENİ: ürünün öne çıkan görseli, yoksa null
    trend: Trend | null; // <-- YENİ: null = trend okuyacak kadar veri yok
    // YENİ (tedarik süresi): ikisi de null = satış hızı hesaplanamadığı
    // için (insufficient_data) öneri de üretilemiyor.
    reorderByDays: number | null; // negatifse: sipariş için ZATEN gecikilmiş demek
    suggestedReorderQty: number | null; // leadTime + coverage süresini karşılayacak, mevcut stok düşülmüş miktar
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

// --- YENİ: trend oku. Son 7 gün ile ondan önceki 7 günü karşılaştırır. ---
// %15'ten küçük değişim gürültü sayılır ve "sabit" (flat) olarak işaretlenir —
// aksi halde 3 satışın 4'e çıkması bile "artıyor" gösterip anlamsız gürültü yaratır.
const TREND_WINDOW_DAYS = 7;
const TREND_CHANGE_THRESHOLD = 0.15;

function sumUnitsInAgeRange(sales: VariantSales, now: Date, minAgeInclusive: number, maxAgeExclusive: number): number {
    let sum = 0;
    for (const [day, qty] of Object.entries(sales.byDay)) {
        const age = daysSince(day, now);
        if (age >= minAgeInclusive && age < maxAgeExclusive) sum += qty;
    }
    return sum;
}

function computeTrend(sales: VariantSales | undefined, now: Date): Trend | null {
    if (!sales) return null;
    const recent = sumUnitsInAgeRange(sales, now, 0, TREND_WINDOW_DAYS);
    const previous = sumUnitsInAgeRange(sales, now, TREND_WINDOW_DAYS, TREND_WINDOW_DAYS * 2);

    if (recent === 0 && previous === 0) return null; // karşılaştıracak veri yok
    if (previous === 0) return recent > 0 ? "up" : "flat";

    const change = (recent - previous) / previous;
    if (change > TREND_CHANGE_THRESHOLD) return "up";
    if (change < -TREND_CHANGE_THRESHOLD) return "down";
    return "flat";
}

// --- Ana giriş noktası. `now` test edilebilirlik için parametre — vermezsen
// bugünün tarihi kullanılır. `settings` verilmezse önceki sabit davranış
// (14 günlük eşik) korunur — bkz. DEFAULT_REORDER_SETTINGS. ---
export function computeForecast(
    snapshot: SalesSnapshot,
    now: Date = new Date(),
    settings: ReorderSettings = DEFAULT_REORDER_SETTINGS,
): ForecastResult {
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

        // YENİ (tedarik süresi): dailyRate artık stok 0 olsa bile (veri
        // yeterliyse) hesaplanıyor — aksi halde tükenmiş bir ürün için
        // "ne kadar sipariş vermeliyim" tahmini asla üretilemezdi, oysa
        // bu tam olarak en çok ihtiyaç duyulan an.
        let dailyRate: number | null =
            confidence === "insufficient" ? null : computeDailyRate(sales, now, oneOffDetected);

        // YENİ (Adım 7): üç durum sırayla kontrol edilir.
        let stockoutInDays: number | null = null;
        let method: string;

        if (v.available === 0) {
            // Stok zaten 0. Sıfıra bölme yok, "zaten bitti" durumu net.
            method = "already_out_of_stock";
            stockoutInDays = 0;
        } else if (confidence === "insufficient") {
            // Veri yetersiz (Hydrogen dahil). Dürüstçe null bırakılıyor, hesap denenmiyor.
            method = "insufficient_data";
        } else if (dailyRate && dailyRate > 0) {
            stockoutInDays = Math.round((v.available / dailyRate) * 10) / 10;
            method = "weighted_average";
        } else {
            // Videographer tuzağı: veri geçmişi yeterli ama son dönemde hiç satış yok.
            // "Hızlı satıyor" yalanı yerine dürüst sinyal.
            dailyRate = 0;
            method = "no_recent_sales";
        }

        // YENİ (tedarik süresi): "ne zaman sipariş vermeliyim" ve "ne
        // kadar" — ikisi de dailyRate/stockoutInDays hesaplanabildiği
        // sürece üretiliyor, aksi halde (insufficient_data) null kalıyor.
        const reorderByDays =
            stockoutInDays != null
                ? Math.round((stockoutInDays - settings.leadTimeDays) * 10) / 10
                : null;
        const suggestedReorderQty =
            dailyRate != null && dailyRate > 0
                ? Math.max(0, Math.ceil(dailyRate * (settings.leadTimeDays + settings.coverageDays) - v.available))
                : null;

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
            imageUrl: v.imageUrl, // <-- YENİ
            trend: computeTrend(sales, now), // <-- YENİ
            reorderByDays, // <-- YENİ
            suggestedReorderQty, // <-- YENİ
        });
    }

    return { forecasts, excluded };
}