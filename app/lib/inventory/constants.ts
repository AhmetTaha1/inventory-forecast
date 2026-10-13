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
// NOT: "Grafik/Detay" için ayrı bir sütun denendi (60-96px) ve terk edildi —
// dar/orta genişlikte .invf-list-card'ın (overflow:hidden) sığdırabileceği
// genişliği aşıp son sütunu sessizce kırpıyordu (kullanıcı ekran
// görüntüsüyle bildirdi). Artık ürün detayı ayrı bir SAYFA
// (app.product.$variantId.tsx) ve "Detaylar" linki Durum sütununun İÇİNDE,
// StatusPill'in hemen altında — yeni bir sütun gerektirmiyor.
export const GRID_COLUMNS =
  "minmax(220px, 2.2fr) 150px minmax(80px, 100px) minmax(150px, 180px) minmax(210px, 1.4fr)";

// Yukarıdaki sütunların ASGARİ toplam genişliği:
//   220 + 150 + 80 + 150 + 210 = 810px  (sütunlar)
// + 4 × 28px sütun boşluğu               = 112px
// + 2 × 20px satır iç dolgusu            =  40px
//                                         -------
//                                          962px
// Kart görünümüne geçiş eşiği bu sayıdan BÜYÜK olmalı — aksi halde arada
// kalan genişliklerde tablo kabına sığmaz ve .invf-list-card'ın
// overflow:hidden'ı son sütunu ("Ne zaman biter?") sessizce kırpar.
// Eşik önceden 900px'ti, yani 901-962px arası bu kırpma gerçekten oluyordu.
export const TABLE_TO_CARD_BREAKPOINT_PX = 1000;

// Ücretsiz katmanda takip edilen azami ürün sayısı. Üstü olan mağazalar
// EN ACİL bu kadar ürünü görmeye devam ediyor (liste zaten aciliyete göre
// sıralı), gerisi için yükseltme çağrısı çıkıyor — yani ücretsiz deneyim
// "bozuk" değil, "eksik".
//
// 25 sayısı keyfi değil. Altındaki bir mağaza stoğunu zaten kafasında
// tutabiliyor, bu araca gerçek ihtiyacı yok — onu sınırla zorlamak ödemeye
// değil silmeye iter (silinmeler App Store sıralamasını da düşürür).
// Üstündekiler ise hem ihtiyaç duyuyor hem ödeyebiliyor.
export const FREE_PLAN_PRODUCT_LIMIT = 25;

// Ücretli plandaki ürün sınırı. ŞU AN SINIRSIZ ve bu bilinçli bir sıralama
// kararı: ikinci ücretli kademe ($49, sınırsız) henüz yokken $29'u 200'de
// sınırlamak, 250 ürünlü bir mağazayı "ödedim ama hâlâ göremiyorum"
// durumunda bırakırdı — yükselteceği bir plan olmadan.
//
// $49 kademesi yayına girdiği gün burası 200 yapılacak; başka hiçbir yerde
// değişiklik gerekmiyor.
export const PAID_PLAN_PRODUCT_LIMIT = Number.POSITIVE_INFINITY;
