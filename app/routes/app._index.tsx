import { Suspense } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Await, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeedbackButton } from "../components/FeedbackButton";
import { LoadingScreen } from "../components/LoadingScreen";
import { resolveLocale, getDictionary, type Dictionary, type Locale } from "../lib/translations";
import { buildCategoryMeta } from "../lib/inventory/categoryMeta";
import { CATEGORY_ORDER, PAGE_SIZE, URGENT_DAYS, FREE_PLAN_PRODUCT_LIMIT, PAID_PLAN_PRODUCT_LIMIT } from "../lib/inventory/constants";
import { PAGE_CSS } from "../lib/inventory/styles";
import { dimStyle } from "../lib/inventory/format";
import { useInventoryView } from "../hooks/useInventoryView";
import { AlertBox } from "../components/inventory/AlertBox";
import { SummaryCard } from "../components/inventory/SummaryCard";
import { AllProductsCard } from "../components/inventory/AllProductsCard";
import { TopSellersCard } from "../components/inventory/TopSellersCard";
import { AccuracyCard, ACCURACY_CARD_CSS } from "../components/inventory/AccuracyCard";
import { RefreshBar } from "../components/inventory/RefreshBar";
import { ProductRow } from "../components/inventory/ProductRow";
import { ExportMenu } from "../components/inventory/ExportMenu";
import { getShopSettings, hasTourBeenSeen } from "../lib/shopSettings.server";
import { WelcomeTour } from "../components/WelcomeTour";
import { getActiveSnoozes } from "../lib/snooze.server";
import { resolvePlanTier } from "../lib/partnerBilling.server";
import { getAccuracyScorecard, type AccuracyScorecard } from "../lib/forecastAccuracy.server";
import type { Category } from "../types/inventory";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Shopify, embedded admin uygulamalarının URL'sine mağaza sahibinin admin
  // panelinde kullandığı dili otomatik olarak `locale` query parametresi
  // olarak ekliyor (örn. ?locale=tr, ?locale=de). Faz A: sadece Türkçe
  // çevrildi, başka her dil İngilizce'ye düşüyor (bkz. translations.ts).
  const locale = resolveLocale(url.searchParams.get("locale"));

  // YENİ (akışla yükleme / streaming): getForecastGroups (ilk Shopify
  // senkronizasyonunu içerebilir, büyük mağazalarda uzun sürebilir)
  // BEKLENMİYOR — bir promise olarak döndürülüyor. Sayfa kabuğu
  // (LoadingScreen) ANINDA gidiyor, veri hazır olunca <Suspense>/<Await>
  // ile akışla yerine geliyor. Önceden bu satırdaki `await` tüm sayfayı
  // veri hazır olana kadar bomboş bekletiyordu (kullanıcı geri bildirimi:
  // ilk açılışta uzun süre boş/donuk beyaz ekran).
  // Plan katmani promise'in DISINDA cozuluyor: sonuc 10 dakika onbellekli
  // (bkz. partnerBilling.server.ts), yani ek bir Partner API cagrisi degil.
  const { tier: planTier, planUrl } = await resolvePlanTier(admin);

  const dashboardPromise = (async () => {
    const [{ groups, computedAt, fromCache }, snoozes, shopSettings, tourSeen, scorecard] = await Promise.all([
      getForecastGroups(session.shop, admin, { forceRefresh }),
      getActiveSnoozes(session.shop),
      getShopSettings(session.shop),
      hasTourBeenSeen(session.shop),
      // Karne, forecast yazimiyla paralel okunuyor: en fazla bir yenileme
      // dongusu geriden gelir, 14 gunluk bir olcumde bu onemsiz.
      // Tahmin karnesi premium ozellik — ucretsiz katmanda hic sorgulanmiyor.
      planTier === "paid" ? getAccuracyScorecard(session.shop) : Promise.resolve(null),
    ]);

    // Panonun tarayıcıya gönderdiği yükten, panonun HİÇ kullanmadığı ağır
    // alanları çıkarıyoruz. `salesByDay` tek başına kaydın yarısından
    // fazlası (249 üründe 346 KB'lık yükün ~%52'si) ve sadece ürün DETAY
    // sayfasındaki grafiklerde kullanılıyor — o sayfanın da kendi sunucu
    // loader'ı var, veriyi oradan taze alıyor. `byLocation`/`levelsTruncated`
    // de aynı şekilde yalnızca detay sayfasında. Bunlar panodan çıkınca
    // özellikle mobil bağlantıda indirilen ve ayrıştırılan veri yarıdan
    // fazla azalıyor.
    function stripDetailOnlyFields<T extends object>(item: T) {
      const { salesByDay, byLocation, levelsTruncated, ...rest } = item as T & {
        salesByDay?: unknown;
        byLocation?: unknown;
        levelsTruncated?: unknown;
      };

      // Sipariş MİKTARI premium. Sadece gizlemek yetmez — değeri istemciye
      // göndermeyip yerine bir bayrak koyuyoruz. Böylece hem gerçekten
      // kapalı oluyor, hem de satırda "burada bir şey var ama kilitli"
      // ipucunu gösterebiliyoruz (bayrak olmadan ücretsiz kullanıcı o
      // özelliğin varlığından haberdar olamazdı).
      // reorderByDays BİLEREK kalıyor: "sipariş için süre geçti" uyarısı ve
      // kırmızı aciliyet rengi ücretsiz sürümün vaadinin parçası ("ne zaman").
      if (!canSeeReorderQty) {
        const r = rest as { suggestedReorderQty?: number | null; reorderQtyLocked?: boolean };
        if (r.suggestedReorderQty != null && r.suggestedReorderQty > 0) r.reorderQtyLocked = true;
        r.suggestedReorderQty = null;
      }
      return rest;
    }

    // Erteleme, pahalı ForecastSnapshot yeniden hesaplamasının DIŞINDA,
    // ayrı ve ucuz bir tabloda tutuluyor (bkz. snooze.server.ts) — burada
    // her istekte hızlıca uygulanıyor.
    function splitSnoozed<T extends { variantId: string }>(items: T[], category: Category) {
      const visible: T[] = [];
      const snoozed: { item: T; category: Category; snoozeUntil: Date | null }[] = [];
      for (const item of items) {
        if (snoozes.has(item.variantId)) {
          snoozed.push({ item, category, snoozeUntil: snoozes.get(item.variantId) ?? null });
        } else {
          visible.push(item);
        }
      }
      return { visible, snoozed };
    }

    const outOfStockSplit = splitSnoozed(groups.outOfStock, "out");
    const soonToStockoutSplit = splitSnoozed(groups.soonToStockout, "soon");
    const healthySplit = splitSnoozed(groups.healthy, "healthy");
    const insufficientDataSplit = splitSnoozed(groups.insufficientData, "nodata");
    const deadStockSplit = splitSnoozed(groups.deadStock, "dead");
    const snoozedRows = [
      ...outOfStockSplit.snoozed,
      ...soonToStockoutSplit.snoozed,
      ...healthySplit.snoozed,
      ...insufficientDataSplit.snoozed,
      ...deadStockSplit.snoozed,
    ];
    // Sipariş uyarısı (üstteki kırmızı/sarı kutu) ertelenmiş ürünleri hiç
    // saymamalı — mağaza sahibi bilerek "bunu şimdilik önemseme" dediği bir
    // ürün için uyarı almaya devam etmesin diye erteledi zaten.
    const reorderAlerts = groups.reorderAlerts.filter((f) => !snoozes.has(f.variantId));
    // En çok satanlar da aynı sebeple ertelenmiş ürünleri hariç tutuyor —
    // burada dublicate göstermenin bir anlamı yok, kategorilerden (out/soon/
    // dead/nodata) bağımsız ayrı bir liste olduğu için splitSnoozed'a hiç
    // gerek yok, doğrudan filtrelemek yeterli.
    const topSellers = groups.topSellers.filter((f) => !snoozes.has(f.variantId));

    // Sipariş ayarları (tedarik süresi) hiç yapılmamışsa (onboardedAt yok)
    // panelde bir hatırlatma kartı gösteriyoruz VE ürün satırlarındaki
    // sipariş miktarı önerilerini gizliyoruz — aksi halde hiç ayarlanmamış
    // varsayılan (14 gün) değerlere göre üretilmiş bir sayı, kullanıcı bunu
    // hiç görmeyi/onaylamayı seçmeden sessizce panelde belirirdi.
    const hasReorderSettings = shopSettings?.onboardedAt != null;
    // Siparis MIKTARI onerisi premium ozellik: ucretsiz surum "ne" ve
    // "ne zaman" bitecegini soyluyor, "ne kadar siparis vermeli"yi
    // premium soyluyor. Kontrol SUNUCUDA: miktar istemciye hic
    // gonderilmiyor, sadece gizlenmis olmuyor.
    const canSeeReorderQty = planTier === "paid" && hasReorderSettings;

    // ---- Ücretsiz katman sınırı ------------------------------------------
    // Ücretsiz katmanda takip edilen ürün sayısı sınırlı. Rastgele kesmek
    // yerine ACİLİYET SIRASINA göre dolduruyoruz: stoğu bitenler ve sipariş
    // zamanı gelenler her zaman sınırın içinde kalır, "şimdilik yapacak bir
    // şey olmayanlar" (stok yeterli) en son sırada. Böylece ücretsiz
    // deneyim "bozuk" değil, sadece eksik oluyor — mağaza sahibi en kritik
    // ürünlerini yine de görüyor.
    const budget = { left: planTier === "free" ? FREE_PLAN_PRODUCT_LIMIT : PAID_PLAN_PRODUCT_LIMIT };
    const take = <T,>(items: T[]): T[] => {
      if (budget.left === Number.POSITIVE_INFINITY) return items;
      const slice = items.slice(0, Math.max(0, budget.left));
      budget.left -= slice.length;
      return slice;
    };

    const totalTracked =
      outOfStockSplit.visible.length +
      soonToStockoutSplit.visible.length +
      deadStockSplit.visible.length +
      insufficientDataSplit.visible.length +
      healthySplit.visible.length;

    const outOfStockShown = take(outOfStockSplit.visible);
    const soonShown = take(soonToStockoutSplit.visible);
    const deadShown = take(deadStockSplit.visible);
    const noDataShown = take(insufficientDataSplit.visible);
    const healthyShown = take(healthySplit.visible);
    const shownCount =
      outOfStockShown.length + soonShown.length + deadShown.length + noDataShown.length + healthyShown.length;

    return {
      outOfStock: outOfStockShown.map(stripDetailOnlyFields),
      soonToStockout: soonShown.map(stripDetailOnlyFields),
      healthy: healthyShown.map(stripDetailOnlyFields),
      insufficientData: noDataShown.map(stripDetailOnlyFields),
      deadStock: deadShown.map(stripDetailOnlyFields),
      reorderAlerts: reorderAlerts.map(stripDetailOnlyFields),
      topSellers: topSellers.map(stripDetailOnlyFields),
      snoozedRows: snoozedRows.map((row) => ({ ...row, item: stripDetailOnlyFields(row.item) })),
      computedAt: computedAt.toISOString(),
      fromCache,
      hasReorderSettings,
      canSeeReorderQty,
      scorecard,
      planTier,
      planUrl,
      freeLimit: {
        limited: totalTracked > shownCount,
        shown: shownCount,
        total: totalTracked,
        limit: planTier === "free" ? FREE_PLAN_PRODUCT_LIMIT : PAID_PLAN_PRODUCT_LIMIT,
      },
      // Karşılama turu SADECE ilk açılışta gösterilecek — sunucuda kalıcı
      // olarak işaretleniyor (bkz. shopSettings.server.ts), bir daha asla çıkmaz.
      showTour: !tourSeen,
    };
  })();

  return { dashboardPromise, locale };
};

export default function Index() {
  const { dashboardPromise, locale } = useLoaderData<typeof loader>();
  const t = getDictionary(locale);

  return (
    <Suspense fallback={<LoadingScreen t={t} />}>
      <Await resolve={dashboardPromise}>
        {(dashboard) => <IndexContent {...dashboard} locale={locale} t={t} />}
      </Await>
    </Suspense>
  );
}

// item burada bilinçli olarak `any`: loader'ın döndürdüğü satır tipi
// (computeForecast'ın çıktısı) projenin hiçbir yerinde katı biçimde
// tanımlanmamış — useInventoryView.ts'teki aynı isimli tip alias'ıyla
// aynı yaklaşım.
type InventoryItem = any;

type IndexContentProps = {
  outOfStock: InventoryItem[];
  soonToStockout: InventoryItem[];
  healthy: InventoryItem[];
  insufficientData: InventoryItem[];
  deadStock: InventoryItem[];
  reorderAlerts: InventoryItem[];
  topSellers: InventoryItem[];
  snoozedRows: { item: InventoryItem; category: Category; snoozeUntil: Date | string | null }[];
  computedAt: string;
  fromCache: boolean;
  hasReorderSettings: boolean;
  canSeeReorderQty: boolean;
  planTier: "free" | "paid";
  scorecard: AccuracyScorecard | null;
  freeLimit: { limited: boolean; shown: number; total: number; limit: number };
  planUrl: string | null;
  showTour: boolean;
  locale: Locale;
  t: Dictionary;
};

function IndexContent({
  outOfStock,
  soonToStockout,
  healthy,
  insufficientData,
  deadStock,
  reorderAlerts,
  topSellers,
  snoozedRows,
  computedAt,
  fromCache,
  hasReorderSettings,
  canSeeReorderQty,
  planTier,
  scorecard,
  freeLimit,
  planUrl,
  showTour,
  locale,
  t,
}: IndexContentProps) {
  const categoryMeta = buildCategoryMeta(t);

  const {
    isRefreshing,
    filter,
    queryInput,
    setQueryInput,
    showScrollTop,
    listRef,
    scrollToTop,
    refresh,
    allRows,
    counts,
    filteredRows,
    totalPages,
    currentPage,
    pageRows,
    setPage,
    changeFilter,
    clearFilter,
    showUrgent,
    handleExport,
    lastUpdated,
    alertDescription,
    isFiltered,
    subtitleParts,
    filterContextLabel,
    scrollTopButtonStyle,
    feedbackLeftOffset,
    feedbackIsCramped,
    isScrolling,
    showSnoozed,
    snoozedCount,
    showTopSellers,
    topSellersCount,
    reorderTodayCount,
  } = useInventoryView({
    outOfStock,
    soonToStockout,
    healthy,
    deadStock,
    insufficientData,
    reorderAlerts,
    topSellers,
    snoozedRows,
    computedAt,
    locale,
    t,
    categoryMeta,
    // Export'taki siparis miktari sutunu da premium — hook bu bayragi
    // o sutunu doldurmak icin kullaniyor (bkz. buildExportRows).
    hasReorderSettings: canSeeReorderQty,
  });

  return (
    <>
      <s-page heading={t.pageHeading}>
        <style>{PAGE_CSS + ACCURACY_CARD_CSS}</style>

        <s-stack gap="base">
          <RefreshBar
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            justRefreshed={!fromCache}
            t={t}
            onRefresh={refresh}
            settingsHref={`/app/settings${locale ? `?locale=${locale}` : ""}`}
          />

          <div
            className="invf-page-content"
            style={{ display: "flex", flexDirection: "column", gap: 14, ...dimStyle(isRefreshing) }}
          >
            {/* Acil durum varsa kırmızı uyarı, yoksa sessiz bir onay satırı.
                Hiçbir şey göstermemek "uygulama çalıştı mı?" sorusunu doğuruyordu. */}
            {reorderAlerts.length > 0 ? (
              <AlertBox
                tone={outOfStock.length > 0 ? "critical" : "warning"}
                title={t.reorderAlertTitle(reorderAlerts.length)}
                description={alertDescription}
                actionLabel={t.showUrgentAction}
                onAction={showUrgent}
              />
            ) : (
              allRows.length > 0 && (
                <AlertBox
                  tone="success"
                  title={t.noReorderTitle}
                  description={t.noReorderDescription(URGENT_DAYS)}
                />
              )
            )}

            {/* Sipariş ayarları (tedarik süresi) hiç yapılmamışsa hatırlatma
                kartı — tek seferlik, ayar yapılınca (onboardedAt set edilince)
                bir daha hiç görünmüyor. Zorunlu bir yönlendirme/engelleme
                DEĞİL: ücretsiz katmandaki hiçbir özellik buna bağlı değil,
                sadece isteyen mağaza sahibi sipariş önerilerini açabiliyor. */}
            {/* Ücretsiz katman sınırı: yalnızca gerçekten kesme olduğunda
                çıkıyor. Sınırın altındaki bir mağaza ücretsiz planda olduğunu
                bile fark etmiyor — kimseye gereksiz "yükselt" baskısı
                yapmıyoruz, sadece kesme yaşayan mağazaya durumu dürüstçe
                söylüyoruz. */}
            {freeLimit.limited && (
              <AlertBox
                tone="info"
                title={t.freeLimitTitle(freeLimit.shown, freeLimit.total)}
                description={t.freeLimitDesc(freeLimit.limit)}
                actionLabel={planUrl ? t.freeLimitCta : undefined}
                actionHref={planUrl ?? undefined}
                actionExternal
              />
            )}

            {!hasReorderSettings && allRows.length > 0 && (
              <AlertBox
                tone="info"
                title={t.onboardingPromptTitle}
                description={t.onboardingPromptDesc}
                actionLabel={t.onboardingPromptCta}
                actionHref={`/app/settings${locale ? `?locale=${locale}` : ""}`}
              />
            )}

            <div className="invf-summary">
              {CATEGORY_ORDER.map((cat) => (
                <SummaryCard
                  key={cat}
                  category={cat}
                  count={counts[cat]}
                  active={filter === cat}
                  categoryMeta={categoryMeta}
                  onClick={() => changeFilter(cat)}
                />
              ))}
            </div>

            {/* "Tüm ürünler" bilinçli olarak 4'lü kart grid'inin İÇİNDE değil,
                altında — 5. kart yapmak hem kavramsal karışıklık yaratırdı
                (kategorilerin toplamı bir kategori değildir) hem de grid'in
                "asla 3 sütuna düşmez" düzenini bozardı. */}
            {/* "Tüm ürünler" + "En çok satanlar" yan yana (bkz. .invf-secondary-row) —
                ikisi de 4'lü kategori grid'inin DIŞINDA (kategorilerin
                toplamı/kesişimi bir kategori değil), ama üstteki grid'in
                genişliğine sığacak şekilde 2 sütuna bölünmüş. En çok
                satanlar count=0 ise (hiç satış geçmişi yoksa) "Tüm ürünler"
                tek başına tam genişlik alıyor — boş bir "kutlama" kartı
                göstermenin anlamı yok. */}
            {allRows.length > 0 && (
              <div
                className={
                  counts.healthy > 0 && topSellersCount > 0
                    ? "invf-secondary-row invf-secondary-row--three"
                    : "invf-secondary-row"
                }
              >
                <AllProductsCard
                  count={allRows.length}
                  showingAll={!isFiltered}
                  t={t}
                  onClick={clearFilter}
                  fullWidth={counts.healthy === 0 && topSellersCount === 0}
                />
                {/* "Stok yeterli": sipariş noktası henüz uzak olan ürünler.
                    Sayısı 0 ise hiç gösterilmiyor — boş bir kart yer kaplar,
                    bilgi vermez. */}
                {counts.healthy > 0 && (
                  <SummaryCard
                    category="healthy"
                    count={counts.healthy}
                    active={filter === "healthy"}
                    categoryMeta={categoryMeta}
                    onClick={() => changeFilter("healthy")}
                  />
                )}
                {topSellersCount > 0 && (
                  <TopSellersCard
                    count={topSellersCount}
                    active={filter === "topSellers"}
                    t={t}
                    onClick={showTopSellers}
                  />
                )}
              </div>
            )}

            {/* Tahmin karnesi: sadece gercekten olculmus tahmin varsa
                goruntuleniyor (ilk ~2 haftadan sonra). Bos bir karne
                guven vermek yerine tam tersini yapardi. */}
            {scorecard && <AccuracyCard scorecard={scorecard} t={t} />}

            <span className="invf-hint">{t.filterHint}</span>

            {/* ------------------------- Ürün listesi ------------------------- */}
            <div className="invf-list-card" ref={listRef}>
              <div className="invf-toolbar">
                <div className="invf-toolbar-top">
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                      {t.productsSectionTitle}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "#4A4A4A" }}>
                      {subtitleParts.join(" · ")}
                    </span>
                  </div>

                  <div className="invf-toolbar-actions">
                    {snoozedCount > 0 && filter !== "snoozed" && (
                      <button type="button" className="invf-snoozed-link" onClick={showSnoozed}>
                        {t.snoozeLinkText(snoozedCount)}
                      </button>
                    )}
                    {/* Excel'e aktarma premium — ucretsiz katmanda menu hic
                        render edilmiyor (yerine kucuk bir yukseltme linki). */}
                    {canSeeReorderQty || planTier === "paid" ? (
                    <ExportMenu
                      onExport={handleExport}
                      filteredCount={filteredRows.length}
                      allCount={allRows.length}
                      reorderTodayCount={reorderTodayCount}
                      filterContextLabel={filterContextLabel}
                      isFiltered={isFiltered}
                      t={t}
                    />
                    ) : (
                      planUrl && (
                        <a href={planUrl} target="_top" className="invf-snoozed-link">
                          {t.premiumLockExport} {t.premiumLockCta} →
                        </a>
                      )
                    )}
                    {isFiltered && (
                      <button type="button" className="invf-clear-btn" onClick={clearFilter}>
                        {t.clearFilterButton(allRows.length)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="invf-search">
                  <span className="invf-search-icon">🔍</span>
                  <input
                    type="search"
                    value={queryInput}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchAriaLabel}
                    onChange={(e) => setQueryInput(e.target.value)}
                  />
                </div>
              </div>

              {pageRows.length > 0 && (
                <div className="invf-head">
                  <span>{t.colProduct}</span>
                  <span>{t.colStatus}</span>
                  <span>{t.colStock}</span>
                  <span>{t.colRate}</span>
                  <span>{t.colRunway}</span>
                </div>
              )}

              {pageRows.map(({ item, category, snoozeUntil }) => (
                <ProductRow
                  key={item.variantId}
                  item={item}
                  category={category}
                  categoryMeta={categoryMeta}
                  t={t}
                  locale={locale}
                  showReorderSuggestion={canSeeReorderQty}
                  isSnoozed={filter === "snoozed"}
                  snoozeUntil={snoozeUntil}
                />
              ))}

              {/* Boş durumun üç ayrı sebebi var, hiçbiri aynı metni göstermemeli. */}
              {filteredRows.length === 0 && filter === "snoozed" && (
                <div className="invf-empty">
                  <span style={{ fontSize: 26 }}>🌙</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                    {t.snoozedEmptyTitle}
                  </span>
                  <span style={{ fontSize: 13, color: "#5C5C5C", maxWidth: 380 }}>
                    {t.snoozedEmptyDesc}
                  </span>
                </div>
              )}

              {filteredRows.length === 0 && filter !== "snoozed" && allRows.length === 0 && (
                <div className="invf-empty">
                  <span style={{ fontSize: 26 }}>📦</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                    {t.emptyNoProductsTitle}
                  </span>
                  <span style={{ fontSize: 13, color: "#5C5C5C", maxWidth: 380 }}>
                    {t.emptyNoProductsDesc}
                  </span>
                </div>
              )}

              {filteredRows.length === 0 && filter !== "snoozed" && allRows.length > 0 && (
                <div className="invf-empty">
                  <span style={{ fontSize: 26 }}>🔍</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                    {t.emptyFilteredTitle}
                  </span>
                  <span style={{ fontSize: 13, color: "#5C5C5C" }}>
                    {t.emptyFilteredDesc}
                  </span>
                  <button
                    type="button"
                    className="invf-clear-btn"
                    style={{ marginTop: 6 }}
                    onClick={clearFilter}
                  >
                    {t.clearFilterButton(allRows.length)}
                  </button>
                </div>
              )}

              {filteredRows.length > PAGE_SIZE && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "13px 18px",
                    borderTop: "1px solid #EBEBEB",
                  }}
                >
                  <button
                    type="button"
                    className="invf-pagebtn"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    {t.prevPage}
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>
                    {t.pageOf(currentPage, totalPages)}
                  </span>
                  <button
                    type="button"
                    className="invf-pagebtn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    {t.nextPage}
                  </button>
                </div>
              )}

              {allRows.length > 0 && <div className="invf-foot">{t.footerNote}</div>}
            </div>
          </div>
        </s-stack>
      </s-page>

      {/* s-page'in DIŞINDA render ediliyor ki position:fixed gerçekten
          tarayıcı penceresine göre sabitlensin (bir Polaris web bileşeni
          içeride transform kullanırsa fixed, viewport yerine ona göre
          sabitlenebilir). Bu yüzden hem "yukarı çık" hem "geri bildirim"
          butonu burada, s-page'e kardeş eleman olarak duruyor. */}

      {/* Geri bildirim: sol altta sabit/yüzen, sayfanın her yerinden
          scroll etmeden erişilebilir. Kendi konumunu ve stilini kendi
          bileşen dosyasında (FeedbackButton.tsx) taşıyor. Dil, admin
          panelinin dilinden (locale) geliyor, kendi başına tespit etmiyor. */}
      <FeedbackButton
        locale={locale}
        leftOffset={feedbackLeftOffset}
        isCramped={feedbackIsCramped}
        isScrolling={isScrolling}
      />

      {showTour && <WelcomeTour t={t} />}

      {showScrollTop && (
        <button
          type="button"
          className="invf-scrolltop-btn"
          style={scrollTopButtonStyle}
          onClick={scrollToTop}
          aria-label={t.scrollTopAriaLabel}
          title={t.scrollTopTitle}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5M12 5L6 11M12 5L18 11"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
