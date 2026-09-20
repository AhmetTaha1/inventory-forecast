import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeedbackButton } from "../components/FeedbackButton";
import { resolveLocale, getDictionary } from "../lib/translations";
import { buildCategoryMeta } from "../lib/inventory/categoryMeta";
import { CATEGORY_ORDER, PAGE_SIZE, URGENT_DAYS } from "../lib/inventory/constants";
import { PAGE_CSS } from "../lib/inventory/styles";
import { dimStyle } from "../lib/inventory/format";
import { useInventoryView } from "../hooks/useInventoryView";
import { AlertBox } from "../components/inventory/AlertBox";
import { SummaryCard } from "../components/inventory/SummaryCard";
import { AllProductsCard } from "../components/inventory/AllProductsCard";
import { RefreshBar } from "../components/inventory/RefreshBar";
import { ProductRow } from "../components/inventory/ProductRow";
import { getShopSettings } from "../lib/shopSettings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Shopify, embedded admin uygulamalarının URL'sine mağaza sahibinin admin
  // panelinde kullandığı dili otomatik olarak `locale` query parametresi
  // olarak ekliyor (örn. ?locale=tr, ?locale=de). Faz A: sadece Türkçe
  // çevrildi, başka her dil İngilizce'ye düşüyor (bkz. translations.ts).
  const locale = resolveLocale(url.searchParams.get("locale"));

  const { groups, computedAt, fromCache } = await getForecastGroups(session.shop, admin, {
    forceRefresh,
  });

  // YENİ (tedarik süresi): sipariş ayarları hiç yapılmamışsa (onboardedAt
  // yok) panelde bir hatırlatma kartı gösteriyoruz VE ürün satırlarındaki
  // sipariş miktarı önerilerini gizliyoruz — aksi halde hiç ayarlanmamış
  // varsayılan (14 gün) değerlere göre üretilmiş bir sayı, kullanıcı bunu
  // hiç görmeyi/onaylamayı seçmeden sessizce panelde belirirdi.
  const shopSettings = await getShopSettings(session.shop);
  const hasReorderSettings = shopSettings?.onboardedAt != null;

  return {
    ...groups,
    computedAt: computedAt.toISOString(),
    fromCache,
    locale,
    hasReorderSettings,
  };
};

export default function Index() {
  const {
    outOfStock,
    soonToStockout,
    insufficientData,
    deadStock,
    reorderAlerts,
    computedAt,
    fromCache,
    locale,
    hasReorderSettings,
  } = useLoaderData<typeof loader>();

  const t = getDictionary(locale);
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
  } = useInventoryView({
    outOfStock,
    soonToStockout,
    deadStock,
    insufficientData,
    reorderAlerts,
    computedAt,
    locale,
    t,
    categoryMeta,
    hasReorderSettings,
  });

  return (
    <>
      <s-page heading={t.pageHeading}>
        <style>{PAGE_CSS}</style>

        <s-stack gap="base">
          <RefreshBar
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            justRefreshed={!fromCache}
            t={t}
            onRefresh={refresh}
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
            {allRows.length > 0 && (
              <AllProductsCard
                count={allRows.length}
                showingAll={!isFiltered}
                t={t}
                onClick={clearFilter}
              />
            )}

            <span className="invf-hint">{t.filterHint}</span>

            {/* ------------------------- Ürün listesi ------------------------- */}
            <div className="invf-list-card" ref={listRef}>
              <div className="invf-toolbar">
                <div className="invf-toolbar-top">
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                      {t.productsSectionTitle}
                    </span>
                    <span style={{ fontSize: 13, color: "#5C5C5C" }}>
                      {subtitleParts.join(" · ")}
                    </span>
                  </div>

                  <div className="invf-toolbar-actions">
                    {filteredRows.length > 0 && (
                      <button
                        type="button"
                        className="invf-export-btn"
                        onClick={handleExport}
                        title={t.excelTooltip(filterContextLabel, filteredRows.length)}
                      >
                        {t.excelButton(filteredRows.length)}
                      </button>
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

              {pageRows.map(({ item, category }) => (
                <ProductRow
                  key={item.variantId}
                  item={item}
                  category={category}
                  categoryMeta={categoryMeta}
                  t={t}
                  locale={locale}
                  showReorderSuggestion={hasReorderSettings}
                />
              ))}

              {/* Boş durumun iki ayrı sebebi var, ikisi aynı metni göstermemeli. */}
              {filteredRows.length === 0 && allRows.length === 0 && (
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

              {filteredRows.length === 0 && allRows.length > 0 && (
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
