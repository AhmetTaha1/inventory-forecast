import type { CSSProperties } from "react";
import { intlLocale, type Locale, type Dictionary } from "../translations";
import { RATE_MIN_READABLE } from "./constants";

export function dimStyle(dimmed: boolean): CSSProperties {
  return {
    opacity: dimmed ? 0.45 : 1,
    transition: "opacity 150ms ease",
    pointerEvents: dimmed ? "none" : "auto",
  };
}

export function initials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["the", "a", "an"].includes(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

// Shopify'ın GraphQL ID'leri her zaman "gid://shopify/Product/123456789" formatında.
// Admin'in "shopify://admin/products/{id}" navigasyon protokolü ise SADECE sayısal
// ID'yi bekliyor — bu yüzden GID'in son "/" sonrasını ayıklıyoruz. Format hiç
// değişmediği için bu her zaman güvenilir (Shopify'ın kendi GID şemasının bir parçası).
export function productAdminId(gid: string): string {
  const idx = gid.lastIndexOf("/");
  return idx === -1 ? gid : gid.slice(idx + 1);
}

/**
 * Satış hızını ürüne göre en okunabilir birimde yazar.
 * Hızlı satan ürün günlük, orta hızlı haftalık, yavaş satan aylık gösterilir.
 * Birim her zaman metnin içinde yazılı olduğu için satırlar karışmaz.
 */
export function rateText(dailyRate: number | null | undefined, t: Dictionary): string {
  if (dailyRate == null) return t.rateDash;
  if (dailyRate <= 0) return t.rateNoSales;

  if (dailyRate >= RATE_MIN_READABLE) {
    return t.ratePerDay(Math.round(dailyRate));
  }

  const weekly = dailyRate * 7;
  if (weekly >= RATE_MIN_READABLE) {
    return t.ratePerWeek(Math.round(weekly));
  }

  const monthly = dailyRate * 30;
  if (monthly >= 1) {
    return t.ratePerMonth(Math.round(monthly));
  }
  return t.rateLessThanOnePerMonth;
}

// "Güven" teknik bir terim; düz cümleye çeviriyoruz.
// forecast.ts'teki Confidence tipiyle birebir eşleşir: "normal" | "low" | "insufficient".
// confidence "insufficient" olduğunda forecast.ts method'u "insufficient_data" yapıyor,
// forecastCache.server.ts da tam bu method'a göre ürünleri ayrı bir kategoriye
// ("Tahmin yok") ayırıyor — yani bu fonksiyona hiç ulaşmıyorlar.
// "normal" (yeterli veri) için bilerek hiçbir not göstermiyoruz — not yoksa
// "güvenilir" demek, sadece "low" (az veri) durumunda uyarı çıkıyor. Bu,
// sektördeki iyi pratikle örtüşüyor: yeni/az verili ürünler ayrı işaretlenir,
// güvenilir tahminler ekstra bir rozetle kalabalıklaştırılmaz.
export function confidenceText(value: string, t: Dictionary): string | null {
  if (value === "low") return t.lowConfidenceNote;
  return null;
}

export function stockoutDateText(days: number, locale: Locale): string {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString(intlLocale(locale), {
    day: "numeric",
    month: "long",
  });
}
