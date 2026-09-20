import type { Category } from "../../types/inventory";

export const PAGE_SIZE = 25;

// forecastCache.server.ts içindeki REORDER_ALERT_DAYS ile aynı olmalı.
export const URGENT_DAYS = 14;

// Satış hızı birimi seçilirken sayının bu değerin altına düşmemesi hedeflenir.
// Böylece "0,8" gibi okunması zor ondalıklar ekrana hiç çıkmaz.
export const RATE_MIN_READABLE = 3;

// Arama kutusu için gecikme. Her tuş vuruşunda değil, kullanıcı durduğunda
// filtreleme yapılır. Büyük ürün sayısında (1000+) gereksiz yeniden
// hesaplamaları önlemek için eklendi.
export const SEARCH_DEBOUNCE_MS = 220;

// "Yukarı çık" butonunun belirmesi için gereken kaydırma miktarı (piksel).
export const SCROLL_TOP_THRESHOLD = 400;

// Yüzen butonlar (Feedback / Yukarı çık) aktif kaydırma sırasında soluklaşıp
// küçülüyor — kaydırma bittikten bu kadar süre sonra normale dönüyorlar.
// Amaç: floating buton, kayan bir liste satırının üzerinden geçerken metni
// tamamen kapatmasın (bkz. useInventoryView.ts).
export const SCROLL_IDLE_DELAY_MS = 250;

export const CATEGORY_ORDER: Category[] = ["out", "soon", "dead", "nodata"];

// "Tüm ürünler" kartının rengi — herhangi bir kategoriyle çakışmasın diye
// Shopify'ın standart yeşili kullanıldı.
export const ALL_PRODUCTS_ACCENT = "#008060";

// Sütunlar: Ürün · Durum · Stok · Satış hızı · Ne zaman biter?
export const GRID_COLUMNS =
  "minmax(220px, 2.2fr) 150px minmax(80px, 100px) minmax(150px, 180px) minmax(210px, 1.4fr)";
