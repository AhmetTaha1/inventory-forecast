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

// Türkçe'de ay adına eklenen kesme işaretli ek, ÜNLÜ UYUMUNA göre ay ay
// değişir ("Ocak'a" ama "Eylül'e"; "Ocak'ta" ama "Nisan'da") — sabit bir
// "'e"/"'de" eki çoğu ayda dilbilgisi hatasına yol açıyordu (ör. "Ocak'e
// kadar ertelendi" yanlış, doğrusu "Ocak'a kadar ertelendi"). dateText
// her zaman "GÜN AY" formatında (bkz. format.ts: absoluteDateText/
// stockoutDateText — yıl asla eklenmiyor), o yüzden son kelime her zaman
// bu 12 sabit ay adından biri.
const TR_MONTH_DATIVE_SUFFIX: Record<string, string> = {
  Ocak: "'a", Şubat: "'a", Mart: "'a", Nisan: "'a", Mayıs: "'a", Haziran: "'a",
  Temmuz: "'a", Ağustos: "'a", Eylül: "'e", Ekim: "'e", Kasım: "'a", Aralık: "'a",
};
const TR_MONTH_LOCATIVE_SUFFIX: Record<string, string> = {
  Ocak: "'ta", Şubat: "'ta", Mart: "'ta", Nisan: "'da", Mayıs: "'ta", Haziran: "'da",
  Temmuz: "'da", Ağustos: "'ta", Eylül: "'de", Ekim: "'de", Kasım: "'da", Aralık: "'ta",
};
function trMonthSuffix(dateText: string, table: Record<string, string>): string {
  const month = dateText.trim().split(" ").pop() ?? "";
  return table[month] ?? "'a";
}

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
    loadingMessage: string;
    loadingMessageSales: string;
    loadingMessageForecast: string;
    loadingMessageAlmostDone: string;

    // ---- Karşılama turu (WelcomeTour, sadece ilk açılış) ----
    tourAriaLabel: string;
    tourSkip: string;
    tourPrev: string;
    tourNext: string;
    tourFinish: string;
    tourStep1Title: string;
    tourStep1Desc: string;
    tourStep2Title: string;
    tourStep2Desc: string;
    tourStep3Title: string;
    tourStep3Desc: string;
    tourStep4Title: string;
    tourStep4Desc: string;

    // ---- Ürün detay sayfası turu (sadece o sayfaya İLK girişte) ----
    detailsTourAriaLabel: string;
    detailsTourStep1Title: string;
    detailsTourStep1Desc: string;
    detailsTourStep2Title: string;
    detailsTourStep2Desc: string;
    detailsTourStep3Title: string;
    detailsTourStep3Desc: string;
    detailsTourStep4Title: string;
    detailsTourStep4Desc: string;

    // ---- Sipariş ayarları sayfası turu (sadece o sayfaya İLK girişte) ----
    settingsTourAriaLabel: string;
    settingsTourStep1Title: string;
    settingsTourStep1Desc: string;
    settingsTourStep2Title: string;
    settingsTourStep2Desc: string;

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
    categoryHealthyLabel: string;
    categoryHealthyHint: string;
    categoryDeadLabel: string;
    categoryDeadHint: string;
    categoryNoDataLabel: string;
    categoryNoDataHint: string;
    urgentFilterLabel: string;
    snoozedFilterLabel: string;
    topSellersFilterLabel: string;
    topSellersCardTitle: string;
    topSellersCardHint: string;

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

    // ---- Satış trendi (son 7 gün vs önceki 7 gün) ----
    trendUpLabel: string;
    trendDownLabel: string;
    trendFlatLabel: string;

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
    csvReorderQtyHeader: string;
    csvOut: string;
    csvDead: string;
    csvNoDataRunway: string;
    csvDash: string;
    csvToday: string;
    csvDaysLater: (days: number, dateText: string) => string;
    filenameAllProducts: string;
    filenameUrgentProducts: string;
    filenameSnoozedProducts: string;
    filenameTopSellers: string;
    filenamePrefix: string;
    filenameReorderToday: string;
    exportMenuCaretAriaLabel: string;
    exportMenuAllLabel: string;
    exportMenuReorderTodayLabel: string;

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

    // ---- Sipariş ayarları (tedarik süresi + kapsama günü) ----
    reorderSettingsLinkLabel: string;
    onboardingPromptTitle: string;
    onboardingPromptDesc: string;
    onboardingPromptCta: string;
    settingsPageHeading: string;
    settingsIntro: string;
    leadTimeFieldLabel: string;
    leadTimeFieldHelp: string;
    coverageDaysFieldLabel: string;
    coverageDaysFieldHelp: string;
    settingsSaveButton: string;
    settingsBackLink: string;

    // ---- Deneme süresi bandı (app.tsx) ----
    trialBannerDaysLeft: (days: number) => string;
    trialBannerNote: string;
    freeLimitTitle: (shown: number, total: number) => string;
    freeLimitDesc: (limit: number) => string;
    freeLimitCta: string;
    accuracyTitle: string;
    accuracyHeadline: (pct: number, count: number) => string;
    accuracyMedian: (pct: number, horizon: number) => string;
    accuracyExample: (title: string, predicted: number, actual: number) => string;
    premiumLockTitle: string;
    premiumLockCta: string;
    premiumLockDigest: string;
    premiumLockSuppliers: string;
    premiumLockDetails: string;
    premiumLockExport: string;
    navUpgrade: string;
    navManagePlan: string;
    reorderQtyLockedHint: string;
    reorderQtySuggestion: (qty: number) => string;
    reorderQtyByDate: (qty: number, dateText: string) => string;
    reorderOverdueNote: string;
    reorderOverdueWithQty: (qty: number) => string;

    // ---- Ertele (snooze) ----
    snoozeLinkText: (count: number) => string;
    snoozePlaceholder: string;
    snooze7Days: string;
    snooze30Days: string;
    snooze90Days: string;
    snoozeIndefinite: string;
    snoozeSelectAriaLabel: string;
    unsnoozeButton: string;
    snoozedUntilLabel: (dateText: string) => string;
    snoozedIndefiniteLabel: string;
    snoozedEmptyTitle: string;
    snoozedEmptyDesc: string;

    // ---- Ürün detay sayfası (app.product.$variantId.tsx) ----
    detailsLinkLabel: string;
    viewInShopifyAdmin: string;
    chartHistoryTitle: string;
    chartHistorySubtitle: string;
    chartHistoryEmpty: string;
    chartHistoryUnitsSuffix: string;
    chartProjectionTitle: string;
    chartProjectionSubtitle: string;
    chartProjectionEmptyNoSales: string;
    chartProjectionEmptyOutOfStock: string;
    chartProjectionEmptyNoRunway: (days: number) => string;
    chartProjectionStockoutLabel: (dateText: string) => string;
    chartProjectionTodayLabel: string;
    chartProjectionAxisUnit: string;

    // ---- Sağlık skoru (forecast.ts: healthScore/healthLabel) ----
    healthMeterTitle: string;
    healthMeterSubtitle: string;
    healthLabelHealthy: string;
    healthLabelWatch: string;
    healthLabelAtRisk: string;
    healthLabelCritical: string;

    // ---- Çoklu lokasyon dağılımı ----
    locationBreakdownTitle: string;
    locationBreakdownTruncatedNote: string;

    // ---- Satır içi tedarik süresi düzenleme ----
    inlineLeadTimeLabel: string;
    inlineLeadTimeSuffix: string;
    inlineLeadTimeTooltip: string;
    inlineLeadTimeAriaLabel: (productTitle: string) => string;
    inlineLeadTimeCustomBadge: string;
    inlineLeadTimeResetLabel: string;
    inlineLeadTimeSaved: string;
    inlineLeadTimeInvalid: (min: number, max: number) => string;
    inlineLeadTimeOutOfRange: (min: number, max: number) => string;

    // ---- Günlük e-posta özeti ayarları (app.settings.tsx) ----
    digestSectionTitle: string;
    digestSectionDesc: string;
    digestEnableLabel: string;
    digestEmailLabel: string;
    digestEmailPlaceholder: string;
    digestSaveButton: string;
    digestSavedConfirmation: string;
    // Mail içeriği (digest.server.ts) — merchant'ın kendi diliyle gönderiliyor.
    digestEmailSubject: (dateText: string) => string;
    digestEmailGreeting: (shopName: string) => string;
    digestEmailOutOfStockLine: (count: number) => string;
    digestEmailSoonLine: (count: number, days: number) => string;
    digestEmailReorderLine: (count: number) => string;
    digestEmailAllGoodLine: string;
    digestEmailFooter: string;
    digestEmailViewInApp: string;

    // ---- Tedarikçiler (app.suppliers.tsx) ----
    suppliersPageHeading: string;
    suppliersIntro: string;
    suppliersEmpty: string;
    suppliersLeadTimeLine: (days: number) => string;
    suppliersDeleteButton: string;
    suppliersNameLabel: string;
    suppliersNamePlaceholder: string;
    suppliersLeadTimeLabel: string;
    suppliersAddButton: string;
    suppliersEditButton: string;
    suppliersSaveButton: string;
    suppliersCancelButton: string;
    suppliersAssignedCount: (n: number) => string;

    // ---- Ürün detay sayfası: tedarikçi ataması ----
    supplierAssignLabel: string;
    supplierAssignNone: string;
    supplierAssignCustomNote: string;
    supplierManageLink: string;
    supplierAssignSaving: string;

    // ---- Şeffaflık paneli (reorder qty matematiği) ----
    transparencyPanelTitle: string;
    transparencyPanelSubtitle: string;
    transparencyLeadTime: string;
    transparencyCoverageDays: string;
    transparencyDailyAvgSales: string;
    transparencyUnitsSold: (days: number) => string;
    transparencyCurrentStock: string;
    transparencyClosingStock: string;
    transparencyClosingStockHelp: string;
    transparencyResultLabel: string;
    transparencyUnavailable: string;

    // ---- Çok pencereli sipariş tahmini ----
    windowEstimatesTitle: string;
    windowEstimatesSubtitle: string;
    windowEstimatesWindowLabel: (days: number) => string;
    windowEstimatesRateColumn: string;
    windowEstimatesQtyColumn: string;
    windowEstimatesNoData: string;

    // ---- "Simulate" büyüme senaryosu ----
    simulateTitle: string;
    simulateSubtitle: string;
    simulateGrowthLabel: string;
    simulateResultStockout: (dateText: string) => string;
    simulateResultQty: (qty: number) => string;
    simulateUnavailable: string;
};

// ---------------------------------------------------------------------------
// Türkçe (orijinal)
// ---------------------------------------------------------------------------

const tr: Dictionary = {
    pageHeading: "Envanter Tahmini",
    loadingMessage: "Ürünleriniz analiz ediliyor...",
    loadingMessageSales: "Satış geçmişiniz taranıyor...",
    loadingMessageForecast: "Tükenme tahminleri hesaplanıyor...",
    loadingMessageAlmostDone: "Neredeyse hazır...",

    tourAriaLabel: "Uygulamaya hoş geldiniz turu",
    tourSkip: "Atla",
    tourPrev: "Geri",
    tourNext: "İleri",
    tourFinish: "Başlayın",
    tourStep1Title: "Envanter Tahmini'ne hoş geldiniz",
    tourStep1Desc: "Bu panel, hangi ürünün ne zaman tükeneceğini ve ne zaman sipariş vermeniz gerektiğini tek bakışta gösterir.",
    tourStep2Title: "Kartlara tıklayarak filtrele",
    tourStep2Desc: "Üstteki renkli kartlara (Stok bitti, Azalıyor, Satılmıyor vb.) tıklayarak listeyi anında o kategoriye göre süzebilirsin.",
    tourStep3Title: "Her ürün için net bir yol haritası",
    tourStep3Desc: "Listede her ürünün ne zaman biteceğini, satış hızını ve trendini görürsün; gerekmeyen uyarıları da erteleyebilirsin.",
    tourStep4Title: "Sipariş zamanlamanı netleştir",
    tourStep4Desc: "Ayarlar sayfasından tedarik süreni girersen, tam olarak ne kadar ve ne zaman sipariş vermen gerektiğini de söyleriz. İstediğin zaman Excel'e de aktarabilirsin.",

    detailsTourAriaLabel: "Ürün detay sayfası turu",
    detailsTourStep1Title: "Sağlık skoru",
    detailsTourStep1Desc: "Bu ürünün genel durumunun tek bakışta özeti — veri güveni, satış trendi ve stok kapsamı tek bir sayıda.",
    detailsTourStep2Title: "Grafikler ve lokasyonlar",
    detailsTourStep2Desc: "Satış geçmişi, ileriye dönük stok tükenme projeksiyonu ve (birden fazla lokasyonun varsa) stok dağılımı burada.",
    detailsTourStep3Title: "Tedarikçi ata",
    detailsTourStep3Desc: "Bir tedarikçi seç, tedarik süresi otomatik uygulansın — her ürün için elle sayı yazmana gerek kalmaz.",
    detailsTourStep4Title: "Hesabın arkasını gör",
    detailsTourStep4Desc: "Önerilen sipariş miktarının nasıl hesaplandığını, farklı zaman pencerelerine göre tahminleri ve büyüme senaryolarını buradan inceleyebilirsin — kara kutu yok.",

    settingsTourAriaLabel: "Sipariş ayarları sayfası turu",
    settingsTourStep1Title: "Tedarik süresi ve kapsama günü",
    settingsTourStep1Desc: "Panelin ne zaman 'sipariş ver' uyarısı vereceğini bu iki sayı belirliyor — mağaza geneli varsayılan burada.",
    settingsTourStep2Title: "Günlük e-posta özeti",
    settingsTourStep2Desc: "İstersen her gün tükenen/tükenmek üzere olan ürünlerin kısa bir özetini e-postana gönderelim.",

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
    categorySoonHint: "Sipariş zamanı yaklaştı",
    categoryHealthyLabel: "Stok yeterli",
    categoryHealthyHint: "Şimdilik sipariş gerekmiyor",
    categoryDeadLabel: "Satılmıyor",
    categoryDeadHint: "Uzun süredir satış yok",
    categoryNoDataLabel: "Tahmin yok",
    categoryNoDataHint: "Yeterli satış geçmişi yok",
    urgentFilterLabel: "Acil ürünler",
    snoozedFilterLabel: "Ertelenmiş ürünler",
    topSellersFilterLabel: "En çok satanlar",
    topSellersCardTitle: "En çok satanlar",
    topSellersCardHint: "En yüksek satış hızı — kutlamaya değer",

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
        `${context} · ${count} ürünü gerçek bir Excel (.xlsx) dosyası olarak indirir.`,
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

    trendUpLabel: "Satışlar artıyor (son 7 gün, önceki 7 güne göre)",
    trendDownLabel: "Satışlar yavaşlıyor (son 7 gün, önceki 7 güne göre)",
    trendFlatLabel: "Satışlar sabit (son 7 gün, önceki 7 güne göre)",

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
    csvReorderQtyHeader: "Önerilen Sipariş",
    csvOut: "Stok bitti",
    csvDead: "Uzun süredir satılmıyor",
    csvNoDataRunway: "Tahmin için yeterli satış geçmişi yok",
    csvDash: "—",
    csvToday: "Bugün bitebilir",
    csvDaysLater: (days, dateText) => `${days} gün sonra (${dateText} civarı)`,
    filenameAllProducts: "tum-urunler",
    filenameUrgentProducts: "acil-urunler",
    filenameSnoozedProducts: "ertelenmis-urunler",
    filenameTopSellers: "en-cok-satanlar",
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

    reorderSettingsLinkLabel: "Sipariş ayarları",
    onboardingPromptTitle: "Sipariş zamanlamanı netleştir",
    onboardingPromptDesc:
        "Tedarikçinden yeni stok kaç günde geliyor? Bunu bir kez ayarla, tam olarak ne zaman ve ne kadar sipariş vermen gerektiğini gösterelim.",
    onboardingPromptCta: "Ayarları aç",
    settingsPageHeading: "Sipariş ayarları",
    settingsIntro:
        "Bu iki bilgi, sipariş uyarılarının ve önerilen sipariş miktarlarının ne zaman/ne kadar olacağını belirler. İstediğin zaman değiştirebilirsin.",
    leadTimeFieldLabel: "Tedarik süresi (gün)",
    leadTimeFieldHelp: "Sipariş verdikten kaç gün sonra yeni stok elinize ulaşıyor?",
    coverageDaysFieldLabel: "Sipariş kapsama günü",
    coverageDaysFieldHelp: "Yeni stok geldiğinde, kaç günlük talebi daha karşılamak istersin?",
    settingsSaveButton: "Kaydet ve panele dön",
    settingsBackLink: "← Panele dön",
    trialBannerDaysLeft: (days) =>
      days === 1 ? "Ücretsiz denemenizin son günü." : `Ücretsiz denemenizde ${days} gün kaldı.`,
    trialBannerNote: "Deneme bitince aboneliğiniz otomatik olarak başlar; dilediğiniz zaman Shopify yönetim panelinden iptal edebilirsiniz.",
    freeLimitTitle: (shown, total) => `${total} üründen ${shown} tanesi takip ediliyor`,
    freeLimitDesc: (limit) => `Ücretsiz plan en acil ${limit} ürünü gösterir. Tüm ürünleriniz için planı yükseltin.`,
    freeLimitCta: "Planı yükselt",
    accuracyTitle: "Tahmin karnesi",
    accuracyHeadline: (pct, count) => `Tahminlerimizin %${pct}'i gerçeğin ±%25 aralığındaydı (${count} tahmin ölçüldü).`,
    accuracyMedian: (pct, horizon) => `Medyan sapma %${pct}. Her tahmin, yapıldıktan ${horizon} gün sonra gerçekleşen satışla karşılaştırılıyor.`,
    accuracyExample: (title, predicted, actual) => `${title}: ${predicted}/gün dedik, ${actual}/gün oldu`,
    premiumLockTitle: "Premium özellik",
    premiumLockCta: "Planı yükselt",
    premiumLockDigest: "Günlük e-posta özeti premium planda. Her sabah neyin bittiğini ve neyin sipariş edilmesi gerektiğini kutunuza gönderir.",
    premiumLockSuppliers: "Tedarikçi yönetimi premium planda. Her tedarikçinin tedarik süresini bir kez tanımlayıp ürünlere tek tıkla uygularsınız.",
    premiumLockDetails: "Ürün detay analizi premium planda: satış geçmişi grafiği, stok tükenme projeksiyonu, büyüme simülasyonu ve hesabın tüm adımları.",
    premiumLockExport: "Excel'e aktarma premium planda.",
    navUpgrade: "✦ Premium'a geç",
    navManagePlan: "Planı yönet",
    reorderQtyLockedHint: "Önerilen sipariş miktarı — Premium",
    reorderQtySuggestion: (qty) => `~${qty} adet sipariş önerisi`,
    reorderQtyByDate: (qty, dateText) => `${dateText} civarı · ~${qty} adet öner`,
    reorderOverdueNote: "Sipariş için süre geçti — tedarik süresi göz önüne alındığında zaten geç kalınmış olabilir",
    reorderOverdueWithQty: (qty) => `Sipariş için süre geçti — hemen ~${qty} adet sipariş ver`,

    snoozeLinkText: (count) => `🌙 ${count} ürün ertelendi`,
    snoozePlaceholder: "Ertele...",
    snooze7Days: "7 gün ertele",
    snooze30Days: "30 gün ertele",
    snooze90Days: "90 gün ertele",
    snoozeIndefinite: "Süresiz ertele",
    snoozeSelectAriaLabel: "Bu ürünü ertele",
    unsnoozeButton: "Ertelemeyi kaldır",
    snoozedUntilLabel: (dateText) => `${dateText}${trMonthSuffix(dateText, TR_MONTH_DATIVE_SUFFIX)} kadar ertelendi`,
    snoozedIndefiniteLabel: "Süresiz ertelendi",
    snoozedEmptyTitle: "Ertelenmiş ürün yok",
    snoozedEmptyDesc: "Sezonu geçmiş ya da bilerek stoklamadığın ürünleri buradan erteleyip uyarı listelerinden çıkarabilirsin.",

    detailsLinkLabel: "Detaylar",
    viewInShopifyAdmin: "Shopify'da görüntüle",
    chartHistoryTitle: "Satış geçmişi",
    chartHistorySubtitle: "Son 12 haftanın haftalık satış adedi",
    chartHistoryEmpty: "Bu ürün için henüz satış kaydı yok.",
    chartHistoryUnitsSuffix: "adet",
    chartProjectionTitle: "Stok tükenme projeksiyonu",
    chartProjectionSubtitle: "Mevcut satış hızına göre stoğun ilerideki seyri",
    chartProjectionEmptyNoSales: "Bir projeksiyon çizebilmek için yeterli satış verisi yok.",
    chartProjectionEmptyOutOfStock: "Bu ürün zaten stokta yok.",
    chartProjectionEmptyNoRunway: (days) => `Bu satış hızıyla stok önümüzdeki ${days} gün içinde tükenmiyor.`,
    chartProjectionStockoutLabel: (dateText) => `${dateText}${trMonthSuffix(dateText, TR_MONTH_LOCATIVE_SUFFIX)} tükeniyor`,
    chartProjectionTodayLabel: "Bugün",
    chartProjectionAxisUnit: "adet",

    filenameReorderToday: "bugun-siparis-edilecekler",
    exportMenuCaretAriaLabel: "Daha fazla dışa aktarma seçeneği",
    exportMenuAllLabel: "Tüm ürünler",
    exportMenuReorderTodayLabel: "Bugün sipariş edilecekler",

    healthMeterTitle: "Sağlık skoru",
    healthMeterSubtitle: "Veri güveni, satış trendi ve stok kapsamının tek bir özeti",
    healthLabelHealthy: "Sağlıklı",
    healthLabelWatch: "İzlemede",
    healthLabelAtRisk: "Riskli",
    healthLabelCritical: "Kritik",

    locationBreakdownTitle: "Lokasyonlara göre stok",
    locationBreakdownTruncatedNote: "Çok sayıda lokasyon var — bazıları bu listede görünmüyor olabilir.",

    inlineLeadTimeLabel: "Tedarik süresi",
    inlineLeadTimeSuffix: "gün",
    inlineLeadTimeTooltip: "Sipariş verdikten sonra yeni stoğun elinize ulaşması kaç gün sürüyor? Bu sayı, ne zaman ve ne kadar sipariş vermeniz gerektiğini hesaplamak için kullanılıyor.",
    inlineLeadTimeAriaLabel: (productTitle) => `${productTitle} için tedarik süresi (gün)`,
    inlineLeadTimeCustomBadge: "özel",
    inlineLeadTimeResetLabel: "Varsayılana dön",
    inlineLeadTimeSaved: "Kaydedildi",
    inlineLeadTimeInvalid: (min, max) => `Bir sayı gir (${min}-${max} gün)`,
    inlineLeadTimeOutOfRange: (min, max) => `${min}-${max} gün arasında olmalı`,

    digestSectionTitle: "Günlük e-posta özeti",
    digestSectionDesc: "Her gün, tükenen/tükenmek üzere olan ve sipariş verilmesi gereken ürünlerin kısa bir özetini e-postana gönderelim.",
    digestEnableLabel: "Günlük özeti e-postayla gönder",
    digestEmailLabel: "E-posta adresi",
    digestEmailPlaceholder: "sen@magazan.com",
    digestSaveButton: "Kaydet",
    digestSavedConfirmation: "Kaydedildi",
    digestEmailSubject: (dateText) => `Envanter Tahmini — ${dateText} günlük özet`,
    digestEmailGreeting: (shopName) => `Merhaba ${shopName},`,
    digestEmailOutOfStockLine: (count) => `${count} ürün stokta yok.`,
    digestEmailSoonLine: (count, days) => `${count} ürün için sipariş zamanı yaklaştı (${days} gün içinde sipariş verilmeli).`,
    digestEmailReorderLine: (count) => `${count} ürün için sipariş verme zamanı geldi (ya da geçti).`,
    digestEmailAllGoodLine: "Bugün acil bir durum yok — her şey yolunda görünüyor.",
    digestEmailFooter: "Bu e-postayı almak istemiyorsan, Envanter Tahmini > Sipariş ayarları sayfasından kapatabilirsin.",
    digestEmailViewInApp: "Panelde görüntüle",

    suppliersPageHeading: "Tedarikçiler",
    suppliersIntro: "Her tedarikçi için bir kez tedarik süresi tanımla, sonra ürün detay sayfasından tek tıkla ürünlere uygula — her seferinde elle sayı yazmana gerek kalmaz.",
    suppliersEmpty: "Henüz tedarikçi eklenmedi.",
    suppliersLeadTimeLine: (days) => `${days} gün tedarik süresi`,
    suppliersDeleteButton: "Sil",
    suppliersNameLabel: "Tedarikçi adı",
    suppliersNamePlaceholder: "ör. Acme Tedarik A.Ş.",
    suppliersLeadTimeLabel: "Tedarik süresi (gün)",
    suppliersAddButton: "Ekle",
    suppliersEditButton: "Düzenle",
    suppliersSaveButton: "Kaydet",
    suppliersCancelButton: "Vazgeç",
    suppliersAssignedCount: (n) =>
      n === 0 ? "Henüz hiçbir ürüne atanmadı" : n === 1 ? "1 ürüne atandı" : `${n} ürüne atandı`,

    supplierAssignLabel: "Tedarikçi",
    supplierAssignNone: "Yok (mağaza varsayılanı)",
    supplierAssignCustomNote: "Özel bir değer girilmiş (tedarikçiye bağlı değil)",
    supplierManageLink: "Tedarikçileri yönet →",
    supplierAssignSaving: "Kaydediliyor, tahmin güncelleniyor...",

    transparencyPanelTitle: "Sipariş miktarı nasıl hesaplandı?",
    transparencyPanelSubtitle: "Kara kutu değil — önerinin arkasındaki tüm sayılar",
    transparencyLeadTime: "Tedarik süresi",
    transparencyCoverageDays: "Kapsama günü",
    transparencyDailyAvgSales: "Günlük ortalama satış",
    transparencyUnitsSold: (days) => `Satılan adet (son ${days} gün)`,
    transparencyCurrentStock: "Mevcut stok",
    transparencyClosingStock: "Kapanış stoğu (sipariş verilmezse)",
    transparencyClosingStockHelp: "Tedarik süresi + kapsama günü sonunda, hiç sipariş verilmezse stok tahmini",
    transparencyResultLabel: "→ Önerilen sipariş miktarı",
    transparencyUnavailable: "Yeterli satış verisi olmadığı için hesaplanamıyor.",

    windowEstimatesTitle: "Farklı zaman pencerelerine göre tahmin",
    windowEstimatesSubtitle: "Tek bir sayıya güvenmek yerine, farklı dönemlere göre karşılaştır",
    windowEstimatesWindowLabel: (days) => `Son ${days} gün`,
    windowEstimatesRateColumn: "Günlük hız",
    windowEstimatesQtyColumn: "Önerilen adet",
    windowEstimatesNoData: "Veri yok",

    simulateTitle: "Büyüme senaryosu dene",
    simulateSubtitle: "Satışlar artarsa/azalırsa tahmin nasıl değişir?",
    simulateGrowthLabel: "Beklenen değişim (%)",
    simulateResultStockout: (dateText) => `Bu hızla stok ${dateText} tarihinde tükenir`,
    simulateResultQty: (qty) => `Önerilen sipariş: ~${qty} adet`,
    simulateUnavailable: "Bu ürün için satış hızı hesaplanamadığından senaryo denenemiyor.",
};

// ---------------------------------------------------------------------------
// İngilizce (fallback — Türkçe dışındaki tüm diller buraya düşer)
// ---------------------------------------------------------------------------

const en: Dictionary = {
    pageHeading: "Inventory Forecast",
    loadingMessage: "Analyzing your products...",
    loadingMessageSales: "Scanning your sales history...",
    loadingMessageForecast: "Calculating stockout forecasts...",
    loadingMessageAlmostDone: "Almost there...",

    tourAriaLabel: "Welcome tour",
    tourSkip: "Skip",
    tourPrev: "Back",
    tourNext: "Next",
    tourFinish: "Get started",
    tourStep1Title: "Welcome to Inventory Forecast",
    tourStep1Desc: "This dashboard shows you at a glance which products will run out, and when you need to reorder.",
    tourStep2Title: "Click the cards to filter",
    tourStep2Desc: "Click any of the colored cards above (Out of stock, Running low, Not selling, etc.) to instantly filter the list by that category.",
    tourStep3Title: "A clear plan for every product",
    tourStep3Desc: "The list shows when each product will run out, its sales speed and trend — and you can snooze alerts you don't need right now.",
    tourStep4Title: "Set your reorder timing",
    tourStep4Desc: "Enter your lead time in Settings and we'll tell you exactly how much and when to reorder. You can export the list to Excel anytime.",

    detailsTourAriaLabel: "Product detail page tour",
    detailsTourStep1Title: "Health score",
    detailsTourStep1Desc: "A one-glance summary of this product's overall state — data confidence, sales trend, and stock coverage in a single number.",
    detailsTourStep2Title: "Charts and locations",
    detailsTourStep2Desc: "Sales history, a forward stock depletion projection, and (if it's stocked in more than one place) the location breakdown.",
    detailsTourStep3Title: "Assign a supplier",
    detailsTourStep3Desc: "Pick a supplier and its lead time is applied automatically — no more typing the same number for every product.",
    detailsTourStep4Title: "See the math behind it",
    detailsTourStep4Desc: "Check exactly how the suggested reorder quantity was calculated, compare estimates across time windows, and try growth scenarios — no black box.",

    settingsTourAriaLabel: "Reorder settings page tour",
    settingsTourStep1Title: "Lead time and coverage days",
    settingsTourStep1Desc: "These two numbers decide when the panel warns you to reorder — your shop-wide default lives here.",
    settingsTourStep2Title: "Daily email digest",
    settingsTourStep2Desc: "Turn this on and we'll email you a short daily summary of what's out of stock or running low.",

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
    categorySoonHint: "Reorder window is near",
    categoryHealthyLabel: "Well stocked",
    categoryHealthyHint: "No reorder needed yet",
    categoryDeadLabel: "Not selling",
    categoryDeadHint: "No sales for a long time",
    categoryNoDataLabel: "No forecast",
    categoryNoDataHint: "Not enough sales history",
    urgentFilterLabel: "Urgent products",
    snoozedFilterLabel: "Snoozed products",
    topSellersFilterLabel: "Top sellers",
    topSellersCardTitle: "Top sellers",
    topSellersCardHint: "Your highest sales velocity — worth celebrating",

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
        `${context} · Downloads ${count} products as a real Excel (.xlsx) file.`,
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

    trendUpLabel: "Sales are trending up (last 7 days vs. previous 7 days)",
    trendDownLabel: "Sales are slowing down (last 7 days vs. previous 7 days)",
    trendFlatLabel: "Sales are steady (last 7 days vs. previous 7 days)",

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
    csvReorderQtyHeader: "Suggested Reorder",
    csvOut: "Out of stock",
    csvDead: "Not selling for a long time",
    csvNoDataRunway: "Not enough sales history for a forecast",
    csvDash: "—",
    csvToday: "Could run out today",
    csvDaysLater: (days, dateText) => `In ${days} days (around ${dateText})`,
    filenameAllProducts: "all-products",
    filenameUrgentProducts: "urgent-products",
    filenameSnoozedProducts: "snoozed-products",
    filenameTopSellers: "top-sellers",
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

    reorderSettingsLinkLabel: "Reorder settings",
    onboardingPromptTitle: "Set your reorder timing",
    onboardingPromptDesc:
        "How many days does it take your supplier to deliver new stock? Set this once, and we'll show you exactly when and how much to reorder.",
    onboardingPromptCta: "Open settings",
    settingsPageHeading: "Reorder settings",
    settingsIntro:
        "These two numbers decide when reorder alerts fire and how large the suggested order quantities are. You can change them anytime.",
    leadTimeFieldLabel: "Lead time (days)",
    leadTimeFieldHelp: "How many days after placing an order does new stock arrive?",
    coverageDaysFieldLabel: "Order coverage (days)",
    coverageDaysFieldHelp: "Once new stock arrives, how many more days of demand do you want it to cover?",
    settingsSaveButton: "Save and return to dashboard",
    settingsBackLink: "← Back to dashboard",
    trialBannerDaysLeft: (days) =>
      days === 1 ? "Last day of your free trial." : `${days} days left in your free trial.`,
    trialBannerNote: "Your subscription starts automatically when the trial ends; you can cancel anytime from your Shopify admin.",
    freeLimitTitle: (shown, total) => `Tracking ${shown} of your ${total} products`,
    freeLimitDesc: (limit) => `The free plan shows your ${limit} most urgent products. Upgrade to track all of them.`,
    freeLimitCta: "Upgrade plan",
    accuracyTitle: "Forecast scorecard",
    accuracyHeadline: (pct, count) => `${pct}% of our forecasts landed within ±25% of actual sales (${count} checked).`,
    accuracyMedian: (pct, horizon) => `Median error ${pct}%. Every forecast is compared with what actually sold ${horizon} days later.`,
    accuracyExample: (title, predicted, actual) => `${title}: we said ${predicted}/day, actual was ${actual}/day`,
    premiumLockTitle: "Premium feature",
    premiumLockCta: "Upgrade plan",
    premiumLockDigest: "The daily email digest is a premium feature. Every morning it sends what is out of stock and what needs reordering.",
    premiumLockSuppliers: "Supplier management is a premium feature. Set each supplier's lead time once, then apply it to products in one click.",
    premiumLockDetails: "Product analytics is a premium feature: sales history chart, stock depletion projection, growth simulation and the full calculation behind every number.",
    premiumLockExport: "Excel export is a premium feature.",
    navUpgrade: "✦ Go Premium",
    navManagePlan: "Manage plan",
    reorderQtyLockedHint: "Suggested order quantity — Premium",
    reorderQtySuggestion: (qty) => `~${qty} units suggested`,
    reorderQtyByDate: (qty, dateText) => `around ${dateText} · ~${qty} units suggested`,
    reorderOverdueNote: "Past the reorder point — given your lead time, you may already be behind",
    reorderOverdueWithQty: (qty) => `Past due for reorder — order ~${qty} units now`,

    snoozeLinkText: (count) => `🌙 ${count} snoozed products`,
    snoozePlaceholder: "Snooze...",
    snooze7Days: "Snooze 7 days",
    snooze30Days: "Snooze 30 days",
    snooze90Days: "Snooze 90 days",
    snoozeIndefinite: "Snooze indefinitely",
    snoozeSelectAriaLabel: "Snooze this product",
    unsnoozeButton: "Unsnooze",
    snoozedUntilLabel: (dateText) => `Snoozed until ${dateText}`,
    snoozedIndefiniteLabel: "Snoozed indefinitely",
    snoozedEmptyTitle: "No snoozed products",
    snoozedEmptyDesc: "You can snooze out-of-season or intentionally unstocked products here to remove them from alert lists.",

    detailsLinkLabel: "Details",
    viewInShopifyAdmin: "View in Shopify",
    chartHistoryTitle: "Sales history",
    chartHistorySubtitle: "Weekly units sold over the last 12 weeks",
    chartHistoryEmpty: "No sales recorded yet for this product.",
    chartHistoryUnitsSuffix: "units",
    chartProjectionTitle: "Stock depletion projection",
    chartProjectionSubtitle: "How stock will trend at the current sales rate",
    chartProjectionEmptyNoSales: "Not enough sales data to draw a projection.",
    chartProjectionEmptyOutOfStock: "This product is already out of stock.",
    chartProjectionEmptyNoRunway: (days) => `At this rate, stock won't run out within the next ${days} days.`,
    chartProjectionStockoutLabel: (dateText) => `Runs out ${dateText}`,
    chartProjectionTodayLabel: "Today",
    chartProjectionAxisUnit: "units",

    filenameReorderToday: "reorder-today",
    exportMenuCaretAriaLabel: "More export options",
    exportMenuAllLabel: "All products",
    exportMenuReorderTodayLabel: "Reorder today",

    healthMeterTitle: "Health score",
    healthMeterSubtitle: "One summary of data confidence, sales trend, and stock coverage",
    healthLabelHealthy: "Healthy",
    healthLabelWatch: "Watch",
    healthLabelAtRisk: "At risk",
    healthLabelCritical: "Critical",

    locationBreakdownTitle: "Stock by location",
    locationBreakdownTruncatedNote: "This store has many locations — some may not be shown here.",

    inlineLeadTimeLabel: "Lead time",
    inlineLeadTimeSuffix: "days",
    inlineLeadTimeTooltip: "How many days after you place an order does new stock actually arrive? This number is used to calculate when and how much to reorder.",
    inlineLeadTimeAriaLabel: (productTitle) => `Lead time in days for ${productTitle}`,
    inlineLeadTimeCustomBadge: "custom",
    inlineLeadTimeResetLabel: "Reset to default",
    inlineLeadTimeSaved: "Saved",
    inlineLeadTimeInvalid: (min, max) => `Enter a number (${min}-${max} days)`,
    inlineLeadTimeOutOfRange: (min, max) => `Must be between ${min} and ${max} days`,

    digestSectionTitle: "Daily email digest",
    digestSectionDesc: "Get a short daily email summarizing what's out of stock, running low, or due for reorder.",
    digestEnableLabel: "Email me the daily digest",
    digestEmailLabel: "Email address",
    digestEmailPlaceholder: "you@yourstore.com",
    digestSaveButton: "Save",
    digestSavedConfirmation: "Saved",
    digestEmailSubject: (dateText) => `Inventory Forecast — ${dateText} daily digest`,
    digestEmailGreeting: (shopName) => `Hi ${shopName},`,
    digestEmailOutOfStockLine: (count) => `${count} product${count === 1 ? " is" : "s are"} out of stock.`,
    digestEmailSoonLine: (count, days) => `${count} product${count === 1 ? "" : "s"} should be reordered within ${days} days.`,
    digestEmailReorderLine: (count) => `${count} product${count === 1 ? " is" : "s are"} due (or overdue) for reorder.`,
    digestEmailAllGoodLine: "Nothing urgent today — everything looks good.",
    digestEmailFooter: "Don't want this email? Turn it off from Inventory Forecast > Reorder settings.",
    digestEmailViewInApp: "View in app",

    suppliersPageHeading: "Suppliers",
    suppliersIntro: "Set up each supplier's lead time once, then apply it to products from the product detail page with one click — no more typing the same number over and over.",
    suppliersEmpty: "No suppliers added yet.",
    suppliersLeadTimeLine: (days) => `${days}-day lead time`,
    suppliersDeleteButton: "Delete",
    suppliersNameLabel: "Supplier name",
    suppliersNamePlaceholder: "e.g. Acme Supply Co.",
    suppliersLeadTimeLabel: "Lead time (days)",
    suppliersAddButton: "Add",
    suppliersEditButton: "Edit",
    suppliersSaveButton: "Save",
    suppliersCancelButton: "Cancel",
    suppliersAssignedCount: (n) =>
      n === 0 ? "Not assigned to any product yet" : n === 1 ? "Assigned to 1 product" : `Assigned to ${n} products`,

    supplierAssignLabel: "Supplier",
    supplierAssignNone: "None (shop default)",
    supplierAssignCustomNote: "A custom value is set (not tied to a supplier)",
    supplierManageLink: "Manage suppliers →",
    supplierAssignSaving: "Saving, updating forecast...",

    transparencyPanelTitle: "How was this reorder quantity calculated?",
    transparencyPanelSubtitle: "Not a black box — every number behind the suggestion",
    transparencyLeadTime: "Lead time",
    transparencyCoverageDays: "Coverage days",
    transparencyDailyAvgSales: "Daily average sales",
    transparencyUnitsSold: (days) => `Units sold (last ${days} days)`,
    transparencyCurrentStock: "Current stock",
    transparencyClosingStock: "Closing stock (if you don't reorder)",
    transparencyClosingStockHelp: "Projected stock at the end of lead time + coverage days, assuming no reorder",
    transparencyResultLabel: "→ Suggested reorder quantity",
    transparencyUnavailable: "Can't be calculated — not enough sales data.",

    windowEstimatesTitle: "Estimate by time window",
    windowEstimatesSubtitle: "Don't trust a single number — compare across different periods",
    windowEstimatesWindowLabel: (days) => `Last ${days} days`,
    windowEstimatesRateColumn: "Daily rate",
    windowEstimatesQtyColumn: "Suggested qty",
    windowEstimatesNoData: "No data",

    simulateTitle: "Try a growth scenario",
    simulateSubtitle: "See how the forecast shifts if sales speed up or slow down",
    simulateGrowthLabel: "Expected change (%)",
    simulateResultStockout: (dateText) => `At this rate, stock runs out ${dateText}`,
    simulateResultQty: (qty) => `Suggested reorder: ~${qty} units`,
    simulateUnavailable: "Can't try a scenario — this product has no computable sales rate.",
};

export const DICTS: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
    return DICTS[locale];
}
