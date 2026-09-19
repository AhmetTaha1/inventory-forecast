// ---------------------------------------------------------------------------
// Dil desteği (Faz A: Türkçe + İngilizce fallback)
// ---------------------------------------------------------------------------
// Shopify, embedded admin uygulamalarının URL'sine mağaza sahibinin admin
// panelinde kullandığı dili bir `locale` query parametresi olarak otomatik
// ekliyor (örn. ?locale=tr, ?locale=de, ?locale=fr). Bu, mağazanın müşteri
// diliyle (shop.locale / storefront dili) KARIŞTIRILMAMALI — bu tamamen
// mağaza sahibinin kendi admin arayüzünde gördüğü dil.
//
// Faz A kapsamı: sadece Türkçe ve İngilizce çevrildi. Başka her dil
// (Almanca, Fransızca, İspanyolca, ...) şimdilik İngilizce'ye düşüyor —
// bu bilinçli bir karar (bkz. Proje Bağlamı v11 sonrası karar), gerçek
// çeviri ihtiyacı kurulum verisine göre sonradan değerlendirilecek.

export type Locale = "tr" | "en";

export function resolveLocale(raw: string | null | undefined): Locale {
  if (raw && raw.toLowerCase().startsWith("tr")) return "tr";
  return "en";
}

// Intl.toLocaleDateString / toLocaleString gibi tarayıcı API'lerinin
// beklediği BCP47 kodu. Uygulamanın kendi iki-harfli Locale tipiyle
// (tr/en) karışmasın diye ayrı bir fonksiyon.
export function intlLocale(locale: Locale): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

// ---------------------------------------------------------------------------
// Sözlük şekli
// ---------------------------------------------------------------------------
// Sabit metinler düz string, parametreli metinler fonksiyon. Bu sayede
// TypeScript, tr/en sözlüklerinden biri eksik ya da yanlış tipte bir alan
// içerirse derleme zamanında hata verir — "unutulan çeviri" riski azalır.

export type Dictionary = {
  // ---- Sayfa başlığı / üst şerit ----
  pageHeading: string;
  refreshSubtitle: string;
  lastUpdatedPrefix: string;
  justRefreshed: string;
  refreshing: string;
  refreshButton: string;

  // ---- Uyarı kutusu ----
  reorderAlertTitle: (count: number) => string;
  outOfStockPart: (count: number) => string;
  soonPart: (count: number, days: number) => string;
  showUrgentAction: string;
  noReorderTitle: string;
  noReorderDescription: (days: number) => string;

  // ---- Kategori kartları ----
  categoryOutLabel: string;
  categoryOutHint: string;
  categorySoonLabel: string;
  categorySoonHint: string;
  categoryDeadLabel: string;
  categoryDeadHint: string;
  categoryNoDataLabel: string;
  categoryNoDataHint: string;
  urgentFilterLabel: string;

  // ---- "Tüm ürünler" kartı ----
  allProductsTitle: string;
  allProductsShowingAll: string;
  allProductsClearFilter: string;

  filterHint: string;

  // ---- Ürün listesi araç çubuğu ----
  productsSectionTitle: string;
  subtitleFilteredCount: (total: number, shown: number) => string;
  subtitleFilterPrefix: (label: string) => string;
  subtitleSearchPrefix: (query: string) => string;
  subtitleAllCount: (total: number) => string;
  subtitleSortHint: string;

  excelButton: (count: number) => string;
  excelTooltip: (context: string, count: number) => string;
  clearFilterButton: (count: number) => string;
  searchPlaceholder: string;
  searchAriaLabel: string;

  // ---- Tablo başlıkları / hücre etiketleri (mobilde de aynı metinler) ----
  colProduct: string;
  colStatus: string;
  colStock: string;
  colRate: string;
  colRunway: string;
  stockUnit: string;

  // ---- Satır içerikleri ----
  outRunway: string;
  deadRunway: string;
  noDataRunway: string;
  runwayToday: string;
  runwayDaysSuffix: string;
  runwayAround: (dateText: string) => string;
  lowConfidenceNote: string;

  // ---- Satış hızı metni ----
  rateDash: string;
  rateNoSales: string;
  ratePerDay: (n: number) => string;
  ratePerWeek: (n: number) => string;
  ratePerMonth: (n: number) => string;
  rateLessThanOnePerMonth: string;

  // ---- Boş durumlar ----
  emptyNoProductsTitle: string;
  emptyNoProductsDesc: string;
  emptyFilteredTitle: string;
  emptyFilteredDesc: string;

  // ---- Sayfalama ----
  prevPage: string;
  nextPage: string;
  pageOf: (current: number, total: number) => string;

  // ---- Alt not ----
  footerNote: string;

  // ---- Yukarı çık butonu ----
  scrollTopAriaLabel: string;
  scrollTopTitle: string;

  // ---- CSV dışa aktarma ----
  csvHeaders: string[];
  csvOut: string;
  csvDead: string;
  csvNoDataRunway: string;
  csvDash: string;
  csvToday: string;
  csvDaysLater: (days: number, dateText: string) => string;
  filenameAllProducts: string;
  filenameUrgentProducts: string;
  filenamePrefix: string;

  // ---- Geri bildirim formu (FeedbackButton.tsx) ----
  feedbackTrigger: string;
  feedbackModalTitle: string;
  feedbackModalSubtitle: string;
  feedbackDialogAriaLabel: string;
  feedbackCloseAriaLabel: string;
  feedbackFieldFirstName: string;
  feedbackFieldLastName: string;
  feedbackFieldEmail: string;
  feedbackFieldMessage: string;
  feedbackMessagePlaceholder: string;
  feedbackErrorText: string;
  feedbackSubmit: string;
  feedbackSubmitting: string;
  feedbackSuccessTitle: string;
  feedbackSuccessSubtitle: string;
  feedbackCloseButton: string;
};

// ---------------------------------------------------------------------------
// Türkçe (orijinal)
// ---------------------------------------------------------------------------

const tr: Dictionary = {
  pageHeading: "Envanter Tahmini",
  refreshSubtitle: "Satış hızınıza göre hangi ürünün ne zaman biteceği",
  lastUpdatedPrefix: "Son güncelleme: ",
  justRefreshed: "✓ Az önce güncellendi",
  refreshing: "Yenileniyor…",
  refreshButton: "Verileri yenile",

  reorderAlertTitle: (count) => `${count} ürün için sipariş vakti geldi`,
  outOfStockPart: (count) => `${count} ürünün stoğu bitti`,
  soonPart: (count, days) => `${count} ürün ${days} gün içinde bitiyor`,
  showUrgentAction: "Acil ürünleri göster",
  noReorderTitle: "Şu an sipariş verilmesi gereken ürün yok",
  noReorderDescription: (days) => `Hiçbir ürünün stoğu ${days} gün içinde bitmiyor.`,

  categoryOutLabel: "Stok bitti",
  categoryOutHint: "Şu an satılamıyor",
  categorySoonLabel: "Azalıyor",
  categorySoonHint: "Yakında sipariş verin",
  categoryDeadLabel: "Satılmıyor",
  categoryDeadHint: "Uzun süredir satış yok",
  categoryNoDataLabel: "Tahmin yok",
  categoryNoDataHint: "Yeterli satış geçmişi yok",
  urgentFilterLabel: "Acil ürünler",

  allProductsTitle: "Tüm ürünler",
  allProductsShowingAll: "Şu an bunu görüntülüyorsunuz",
  allProductsClearFilter: "Süzgeci kaldır, hepsini gör",

  filterHint: "Listeyi süzmek için yukarıdaki kartlardan birine dokunun.",

  productsSectionTitle: "Ürünler",
  subtitleFilteredCount: (total, shown) => `${total} üründen ${shown} tanesi gösteriliyor`,
  subtitleFilterPrefix: (label) => `Süzgeç: ${label}`,
  subtitleSearchPrefix: (query) => `Arama: "${query}"`,
  subtitleAllCount: (total) => `${total} ürün`,
  subtitleSortHint: "en acil olanlar en üstte",

  excelButton: (count) => `Excel indir (${count})`,
  excelTooltip: (context, count) =>
    `${context} · ${count} ürünü Excel'de açılabilen bir CSV dosyası olarak indirir.`,
  clearFilterButton: (count) => `Tüm ürünleri göster (${count})`,
  searchPlaceholder: "Ürün adıyla ara",
  searchAriaLabel: "Ürün ara",

  colProduct: "Ürün",
  colStatus: "Durum",
  colStock: "Stok",
  colRate: "Satış hızı",
  colRunway: "Ne zaman biter?",
  stockUnit: "adet",

  outRunway: "Stok bitti — hemen sipariş verin",
  deadRunway: "Uzun süredir satılmıyor",
  noDataRunway: "Tahmin için yeterli satış geçmişi yok",
  runwayToday: "Bugün bitebilir",
  runwayDaysSuffix: "GÜN SONRA",
  runwayAround: (dateText) => `${dateText} civarı`,
  lowConfidenceNote: "Kaba tahmin — satış geçmişi az",

  rateDash: "—",
  rateNoSales: "Satış yok",
  ratePerDay: (n) => `Günde ~${n} adet`,
  ratePerWeek: (n) => `Haftada ~${n} adet`,
  ratePerMonth: (n) => `Ayda ~${n} adet`,
  rateLessThanOnePerMonth: "Ayda 1'den az",

  emptyNoProductsTitle: "Gösterilecek ürün yok",
  emptyNoProductsDesc:
    "Stok takibi açık bir ürün bulunamadı. Shopify'da ürünlerinizin stok takibinin açık olduğundan emin olun, sonra verileri yenileyin.",
  emptyFilteredTitle: "Bu süzgeçle eşleşen ürün yok",
  emptyFilteredDesc: "Aramayı değiştirin ya da tüm ürünlere dönün.",

  prevPage: "← Önceki",
  nextPage: "Sonraki →",
  pageOf: (current, total) => `Sayfa ${current} / ${total}`,

  footerNote:
    "Satış hızı, son 7 / 30 / 90 günlük satışlarınızın ağırlıklı ortalamasıdır. Birim ürünün hızına göre değişir: hızlı satanlarda günlük, yavaş satanlarda aylık gösterilir.",

  scrollTopAriaLabel: "Sayfanın başına dön",
  scrollTopTitle: "Yukarı çık",

  csvHeaders: ["Ürün", "Varyant", "Durum", "Stok", "Satış Hızı", "Ne Zaman Biter", "Not"],
  csvOut: "Stok bitti",
  csvDead: "Uzun süredir satılmıyor",
  csvNoDataRunway: "Tahmin için yeterli satış geçmişi yok",
  csvDash: "—",
  csvToday: "Bugün bitebilir",
  csvDaysLater: (days, dateText) => `${days} gün sonra (${dateText} civarı)`,
  filenameAllProducts: "tum-urunler",
  filenameUrgentProducts: "acil-urunler",
  filenamePrefix: "envanter",

  feedbackTrigger: "Geri bildirim",
  feedbackModalTitle: "Görüş, öneri ya da sorun bildir",
  feedbackModalSubtitle: "Uygulamayı geliştirmemize yardımcı olur, teşekkürler.",
  feedbackDialogAriaLabel: "Geri bildirim formu",
  feedbackCloseAriaLabel: "Kapat",
  feedbackFieldFirstName: "Ad",
  feedbackFieldLastName: "Soyad",
  feedbackFieldEmail: "E-posta",
  feedbackFieldMessage: "Mesajınız",
  feedbackMessagePlaceholder: "Ne düşünüyorsunuz, neyi eksik buldunuz?",
  feedbackErrorText: "Gönderilemedi, lütfen tekrar deneyin.",
  feedbackSubmit: "Gönder",
  feedbackSubmitting: "Gönderiliyor…",
  feedbackSuccessTitle: "Mesajınız iletildi",
  feedbackSuccessSubtitle: "En kısa sürede döneceğiz.",
  feedbackCloseButton: "Kapat",
};

// ---------------------------------------------------------------------------
// İngilizce (fallback — Türkçe dışındaki tüm diller buraya düşer)
// ---------------------------------------------------------------------------

const en: Dictionary = {
  pageHeading: "Inventory Forecast",
  refreshSubtitle: "When each product will run out, based on your sales speed",
  lastUpdatedPrefix: "Last updated: ",
  justRefreshed: "✓ Just updated",
  refreshing: "Refreshing…",
  refreshButton: "Refresh data",

  reorderAlertTitle: (count) => `${count} product${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} reordering`,
  outOfStockPart: (count) => `${count} product${count === 1 ? " is" : "s are"} out of stock`,
  soonPart: (count, days) => `${count} product${count === 1 ? "" : "s"} running out within ${days} days`,
  showUrgentAction: "Show urgent products",
  noReorderTitle: "No products need reordering right now",
  noReorderDescription: (days) => `No product is running out within ${days} days.`,

  categoryOutLabel: "Out of stock",
  categoryOutHint: "Can't be sold right now",
  categorySoonLabel: "Running low",
  categorySoonHint: "Reorder soon",
  categoryDeadLabel: "Not selling",
  categoryDeadHint: "No sales for a long time",
  categoryNoDataLabel: "No forecast",
  categoryNoDataHint: "Not enough sales history",
  urgentFilterLabel: "Urgent products",

  allProductsTitle: "All products",
  allProductsShowingAll: "You're viewing this now",
  allProductsClearFilter: "Clear filter, see everything",

  filterHint: "Tap a card above to filter the list.",

  productsSectionTitle: "Products",
  subtitleFilteredCount: (total, shown) => `Showing ${shown} of ${total} products`,
  subtitleFilterPrefix: (label) => `Filter: ${label}`,
  subtitleSearchPrefix: (query) => `Search: "${query}"`,
  subtitleAllCount: (total) => `${total} products`,
  subtitleSortHint: "most urgent first",

  excelButton: (count) => `Download Excel (${count})`,
  excelTooltip: (context, count) =>
    `${context} · Downloads ${count} products as a CSV file that opens directly in Excel.`,
  clearFilterButton: (count) => `Show all products (${count})`,
  searchPlaceholder: "Search by product name",
  searchAriaLabel: "Search products",

  colProduct: "Product",
  colStatus: "Status",
  colStock: "Stock",
  colRate: "Sales speed",
  colRunway: "When does it run out?",
  stockUnit: "units",

  outRunway: "Out of stock — reorder now",
  deadRunway: "Not selling for a long time",
  noDataRunway: "Not enough sales history for a forecast",
  runwayToday: "Could run out today",
  runwayDaysSuffix: "DAYS LEFT",
  runwayAround: (dateText) => `around ${dateText}`,
  lowConfidenceNote: "Rough estimate — limited sales history",

  rateDash: "—",
  rateNoSales: "No sales",
  ratePerDay: (n) => `~${n} units/day`,
  ratePerWeek: (n) => `~${n} units/week`,
  ratePerMonth: (n) => `~${n} units/month`,
  rateLessThanOnePerMonth: "Less than 1/month",

  emptyNoProductsTitle: "No products to show",
  emptyNoProductsDesc:
    "No products with inventory tracking were found. Make sure inventory tracking is enabled for your products in Shopify, then refresh the data.",
  emptyFilteredTitle: "No products match this filter",
  emptyFilteredDesc: "Try a different search or go back to all products.",

  prevPage: "← Previous",
  nextPage: "Next →",
  pageOf: (current, total) => `Page ${current} of ${total}`,

  footerNote:
    "Sales speed is a weighted average of your last 7 / 30 / 90 days of sales. The unit adapts to the product's speed: daily for fast sellers, monthly for slow ones.",

  scrollTopAriaLabel: "Back to top",
  scrollTopTitle: "Back to top",

  csvHeaders: ["Product", "Variant", "Status", "Stock", "Sales Speed", "Runs Out", "Note"],
  csvOut: "Out of stock",
  csvDead: "Not selling for a long time",
  csvNoDataRunway: "Not enough sales history for a forecast",
  csvDash: "—",
  csvToday: "Could run out today",
  csvDaysLater: (days, dateText) => `In ${days} days (around ${dateText})`,
  filenameAllProducts: "all-products",
  filenameUrgentProducts: "urgent-products",
  filenamePrefix: "inventory",

  feedbackTrigger: "Feedback",
  feedbackModalTitle: "Share feedback, ideas or an issue",
  feedbackModalSubtitle: "Helps us improve the app — thank you.",
  feedbackDialogAriaLabel: "Feedback form",
  feedbackCloseAriaLabel: "Close",
  feedbackFieldFirstName: "First name",
  feedbackFieldLastName: "Last name",
  feedbackFieldEmail: "Email",
  feedbackFieldMessage: "Your message",
  feedbackMessagePlaceholder: "What's on your mind? What's missing?",
  feedbackErrorText: "Couldn't send — please try again.",
  feedbackSubmit: "Send",
  feedbackSubmitting: "Sending…",
  feedbackSuccessTitle: "Message sent",
  feedbackSuccessSubtitle: "We'll get back to you soon.",
  feedbackCloseButton: "Close",
};

export const DICTS: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTS[locale];
}
