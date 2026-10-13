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

// --- YENİ (sağlık skoru): 4 kademeli, açıklanabilir bir özet sinyal.
// Kategori sistemi (out/soon/dead/nodata) zaten var ama kaba (4 kova) —
// health score aynı olguları 0-100 arası tek bir sayıya indirip mağaza
// sahibinin "bu ürün genel olarak ne durumda" sorusuna tek bakışta cevap
// vermesini sağlıyor. "Plain math, not black box" ilkesiyle (bkz.
// ifh_competitor_ideas), formül burada TAMAMEN açık — gizli bir ML modeli
// veya ayarlanamaz sihirli katsayılar yok. ---
export type HealthLabel = "healthy" | "watch" | "at_risk" | "critical";

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
    // YENİ (detaylı grafik): "YYYY-MM-DD" -> o gün satılan adet. Ham veri —
    // hesaplanmış dailyRate/trend'in aksine, ürün detay grafiğinin satış
    // geçmişi çizgisini/çubuklarını çizebilmesi için ayıklanmadan taşınıyor.
    // Hiç satış kaydı yoksa null (confidence "insufficient" ile aynı durum).
    salesByDay: Record<string, number> | null;
    // YENİ (çoklu lokasyon): lokasyon adı -> o lokasyondaki stok adedi.
    // Tek lokasyonlu mağazalarda tek bir anahtar olur — UI bu durumda
    // dağılımı hiç göstermiyor (bkz. ProductCharts.tsx: LocationBreakdown).
    byLocation: Record<string, number>;
    // true ise mağazada çok sayıda lokasyon var ve bazıları (nadir, çok
    // büyük mağaza senaryosu) sorgu sayfalama sınırı yüzünden dahil
    // edilemedi — dürüstçe "eksik olabilir" sinyali.
    levelsTruncated: boolean;
    // YENİ (sağlık skoru): 0-100, formül computeHealthScore()'da açık.
    healthScore: number;
    healthLabel: HealthLabel;
    // YENİ (satır içi tedarik süresi düzenleme): bu varyant için GERÇEKTEN
    // kullanılan değerler — mağaza varsayılanı mı yoksa ürüne özel bir
    // override mı olduğunu UI'ın bilmesine gerek yok, sadece "şu an
    // kullanılan sayı bu" yeterli (bkz. ProductRow.tsx inline input).
    effectiveLeadTimeDays: number;
    effectiveCoverageDays: number;
    // true ise effectiveLeadTimeDays mağaza varsayılanı DEĞİL, bu varyanta
    // özel bir override — UI'da "özel" rozeti + "varsayılana dön" seçeneği
    // bunu kullanıyor.
    leadTimeOverridden: boolean;
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

// --- YENİ (sağlık skoru): 3 bileşenli, ağırlıklı, tamamen açık formül.
// - confidence (%25): veri ne kadar güvenilir?
// - trend (%15): satış yönü nereye gidiyor?
// - coverage (%60, en ağırlıklı — asıl soru "tükeniyor mu?"): stockoutInDays,
//   hedeflenen (leadTime+coverage) süreye oranla ne kadar rahat?
// Üstüne iki düz ceza: sipariş için zaten gecikilmişse (-20), tek seferlik
// anormal bir satış tespit edildiyse (-5, "bu veriye tam güvenme" notu).
function computeHealthScore(args: {
    confidence: Confidence;
    trend: Trend | null;
    stockoutInDays: number | null;
    available: number;
    targetDays: number; // leadTimeDays + coverageDays
    overdue: boolean;
    oneOffDetected: boolean;
    method: string;
}): { score: number; label: HealthLabel } {
    const confidenceScore = { normal: 100, low: 50, insufficient: 0 }[args.confidence];
    const trendScore = args.trend == null ? 70 : { up: 100, flat: 70, down: 40 }[args.trend];

    // "stockoutInDays == null" iki BAMBAŞKA durumdan gelebilir — ikisini
    // aynı nötr 50 puana koymak yanlıştı: "insufficient_data" gerçekten
    // bilmiyoruz demek (nötr doğru), ama "no_recent_sales" (ölü stok)
    // TAM TERSİNE net ve kötü bir sinyal — ürün hiç satmıyor, parası
    // stokta kilitli kalıyor. Eskiden bu durum "watch" gibi masum bir
    // etikete denk gelebiliyordu, oysa "Ölü Stok" kategorisindeki bir
    // ürünün sağlık rozetinin de bunu yansıtması gerekiyor.
    let coverageScore: number;
    if (args.available === 0) {
        coverageScore = 0; // zaten tükenmiş — tartışmasız en kötü durum
    } else if (args.method === "no_recent_sales") {
        coverageScore = 15; // ölü stok — veri eksik değil, net kötü bir durum
    } else if (args.stockoutInDays == null) {
        coverageScore = 50; // gerçekten veri yetersiz, ne iyi ne kötü diyemiyoruz
    } else {
        coverageScore = Math.max(0, Math.min(100, (args.stockoutInDays / args.targetDays) * 100));
    }

    let score = 0.25 * confidenceScore + 0.15 * trendScore + 0.6 * coverageScore;
    if (args.overdue) score -= 20;
    if (args.oneOffDetected) score -= 5;
    score = Math.round(Math.max(0, Math.min(100, score)));

    const label: HealthLabel = score >= 75 ? "healthy" : score >= 50 ? "watch" : score >= 25 ? "at_risk" : "critical";
    return { score, label };
}

// --- Ana giriş noktası. `now` test edilebilirlik için parametre — vermezsen
// bugünün tarihi kullanılır. `settings` verilmezse önceki sabit davranış
// (14 günlük eşik) korunur — bkz. DEFAULT_REORDER_SETTINGS. `overridesByVariant`
// (YENİ, satır içi düzenleme) her varyant için `settings`'i kısmen ezer —
// örn. sadece leadTimeDays'i override edip coverageDays'i mağaza
// varsayılanında bırakmak mümkün. ---
export function computeForecast(
    snapshot: SalesSnapshot,
    now: Date = new Date(),
    settings: ReorderSettings = DEFAULT_REORDER_SETTINGS,
    overridesByVariant?: Map<string, Partial<ReorderSettings>>,
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

        // YENİ (satır içi tedarik süresi): bu varyanta özel bir override
        // varsa mağaza varsayılanının üstüne kısmen (leadTime VEYA
        // coverage, ikisi birden olmak zorunda değil) uygulanıyor.
        const override = overridesByVariant?.get(v.variantId);
        const effectiveSettings: ReorderSettings = {
            leadTimeDays: override?.leadTimeDays ?? settings.leadTimeDays,
            coverageDays: override?.coverageDays ?? settings.coverageDays,
        };

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
                ? Math.round((stockoutInDays - effectiveSettings.leadTimeDays) * 10) / 10
                : null;
        const suggestedReorderQty =
            dailyRate != null && dailyRate > 0
                ? Math.max(0, Math.ceil(dailyRate * (effectiveSettings.leadTimeDays + effectiveSettings.coverageDays) - v.available))
                : null;

        const trend = computeTrend(sales, now);
        const overdue = reorderByDays != null && reorderByDays <= 0;
        const health = computeHealthScore({
            confidence,
            trend,
            stockoutInDays,
            available: v.available,
            targetDays: effectiveSettings.leadTimeDays + effectiveSettings.coverageDays,
            overdue,
            oneOffDetected,
            method,
        });

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
            trend, // <-- YENİ
            reorderByDays, // <-- YENİ
            suggestedReorderQty, // <-- YENİ
            salesByDay: sales ? sales.byDay : null, // <-- YENİ (detaylı grafik)
            byLocation: v.byLocation, // <-- YENİ (çoklu lokasyon)
            levelsTruncated: v.levelsTruncated, // <-- YENİ
            healthScore: health.score, // <-- YENİ
            healthLabel: health.label, // <-- YENİ
            effectiveLeadTimeDays: effectiveSettings.leadTimeDays, // <-- YENİ
            effectiveCoverageDays: effectiveSettings.coverageDays, // <-- YENİ
            leadTimeOverridden: override?.leadTimeDays != null, // <-- YENİ
        });
    }

    return { forecasts, excluded };
}

// ---------------------------------------------------------------------------
// YENİ (çok pencereli sipariş tahmini): Sensible-tarzı rakipten esinlenildi
// (bkz. lead_time_and_snooze_ideas memory: "show 2-3 estimates side-by-side
// from different historical windows... lets the merchant sanity-check
// instead of blindly trusting a black box"). computeForecast()'taki TEK
// ağırlıklı (7/30/90 karışımı) dailyRate'in aksine, burada her pencere
// TAMAMEN BAĞIMSIZ hesaplanıyor — "son 14 günde ne kadar hızlı satıyordu"
// ile "son 90 günde ne kadar hızlı satıyordu" arasındaki farkı görebilsin.
// Girdi sadece salesByDay (VariantForecast'ta zaten var) — ayrı bir
// SalesSnapshot gerekmiyor, bu yüzden ürün detay sayfasından doğrudan
// çağrılabiliyor.
export type WindowEstimate = {
    windowDays: number;
    dailyRate: number | null; // null = bu pencerede hiç veri yok
    suggestedReorderQty: number | null;
};

const REORDER_ESTIMATE_WINDOWS = [14, 30, 60, 90];

export function computeWindowEstimates(
    salesByDay: Record<string, number> | null,
    now: Date,
    available: number,
    settings: ReorderSettings,
): WindowEstimate[] {
    if (!salesByDay) {
        return REORDER_ESTIMATE_WINDOWS.map((windowDays) => ({ windowDays, dailyRate: null, suggestedReorderQty: null }));
    }
    const entries = Object.entries(salesByDay);

    return REORDER_ESTIMATE_WINDOWS.map((windowDays) => {
        const inWindow = entries.filter(([day]) => daysSince(day, now) < windowDays);
        if (inWindow.length === 0) return { windowDays, dailyRate: null, suggestedReorderQty: null };

        const oldestAge = Math.max(...inWindow.map(([day]) => daysSince(day, now)));
        const effectiveWindow = Math.max(1, Math.min(windowDays, oldestAge + 1));
        const sum = inWindow.reduce((s, [, qty]) => s + qty, 0);
        const dailyRate = sum / effectiveWindow;
        const suggestedReorderQty = Math.max(0, Math.ceil(dailyRate * (settings.leadTimeDays + settings.coverageDays) - available));
        return { windowDays, dailyRate, suggestedReorderQty };
    });
}

// ---------------------------------------------------------------------------
// YENİ ("Simulate" — büyüme senaryosu): IFH'den esinlenildi (bkz.
// ifh_competitor_ideas memory: "let the merchant enter an expected growth %
// ... and see the forecast adjust"). Mevcut dailyRate'e düz bir büyüme
// oranı uygulayıp stockoutInDays/suggestedReorderQty'yi YENİDEN hesaplıyor
// — ikinci bir Shopify sorgusu YOK, tamamen mevcut sayılar üzerinden. UI
// bunu istemci tarafında (her tuş vuruşunda) çağırabilir, bu yüzden saf ve
// senkron.
export type SimulationResult = {
    adjustedDailyRate: number;
    stockoutInDays: number | null;
    suggestedReorderQty: number | null;
};

export function simulateGrowth(
    dailyRate: number,
    available: number,
    growthPercent: number,
    settings: ReorderSettings,
): SimulationResult {
    const adjustedDailyRate = Math.max(0, dailyRate * (1 + growthPercent / 100));
    const stockoutInDays = adjustedDailyRate > 0 ? Math.round((available / adjustedDailyRate) * 10) / 10 : null;
    const suggestedReorderQty =
        adjustedDailyRate > 0
            ? Math.max(0, Math.ceil(adjustedDailyRate * (settings.leadTimeDays + settings.coverageDays) - available))
            : null;
    return { adjustedDailyRate, stockoutInDays, suggestedReorderQty };
}