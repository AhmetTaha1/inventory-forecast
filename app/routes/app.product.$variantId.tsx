import type { LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { getShopSettings, hasDetailsTourBeenSeen } from "../lib/shopSettings.server";
import { getActiveSnoozes } from "../lib/snooze.server";
import { getSuppliers, getAssignedSupplierId } from "../lib/suppliers.server";
import { DetailsPageTour } from "../components/DetailsPageTour";
import { resolveLocale, getDictionary } from "../lib/translations";
import { buildCategoryMeta } from "../lib/inventory/categoryMeta";
import { initials, productAdminId, rateText } from "../lib/inventory/format";
import { StatusPill, RunwayCell, TrendArrow, CellLabel } from "../components/inventory/Cells";
import { SnoozeControl } from "../components/inventory/SnoozeControl";
import {
  HealthMeter,
  LocationBreakdown,
  SalesHistoryChart,
  StockProjectionChart,
  PRODUCT_CHARTS_CSS,
} from "../components/inventory/ProductCharts";
import { RUNWAY_CELL_CSS, SNOOZE_CONTROL_CSS } from "../lib/inventory/styles";
import { resolvePlanTier } from "../lib/partnerBilling.server";
import { PremiumLock, PREMIUM_LOCK_CSS } from "../components/inventory/PremiumLock";
import { TransparencyPanel, WindowEstimatesTable, SimulateGrowthCard, SupplierAssignment } from "../components/inventory/ProductAdvancedPanels";
import { INVF_FONT_STACK } from "../lib/fontStack";
import type { Category } from "../types/inventory";

// ---------------------------------------------------------------------------
// Ürün detay sayfası — bir modal/popup DEĞİL, tam bir sayfa (bkz. kullanıcı
// kararı: "yeni bi sayfa acilsin ... koca alan her seyi gosterebiliriz").
// Satır içi bir "Grafiği görüntüle" butonunun sığdırılmaya çalışılması
// (deneme-yanılma: önce durum sütununa, sonra ayrı bir dar sütuna) hem yer
// sıkıntısı hem de kırılgan bir genişlik hesaplaması yaratıyordu. Tam sayfa,
// büyümeye açık: ileride sipariş oluşturma (native PO, hâlâ scope
// gerektirdiği için ertelendi) gibi özellikler burada doğal bir yuva bulacak.
//
// Erteleme kontrolü de BİLEREK buraya taşındı (satırdaki <select> yerine) —
// panel satırları artık sadece durum rozetini gösteriyor, "yönetim" (ertele,
// grafik, ileride sipariş) bu sayfada toplanıyor.
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const variantId = params.variantId as string;

  const [{ groups }, snoozes, shopSettings, suppliers, assignedSupplierId, detailsTourSeen, plan] = await Promise.all([
    getForecastGroups(session.shop, admin),
    getActiveSnoozes(session.shop),
    getShopSettings(session.shop),
    getSuppliers(session.shop),
    getAssignedSupplierId(session.shop, variantId),
    hasDetailsTourBeenSeen(session.shop),
    resolvePlanTier(admin),
  ]);

  // DİKKAT: buraya HER kategori eklenmeli. "healthy" grubu eklendiğinde bu
  // liste güncellenmezse, stoğu rahat olan bir ürünün "Detaylar" butonu
  // ürünü bulamayıp sessizce panele geri atıyordu.
  const buckets: { category: Category; items: typeof groups.outOfStock }[] = [
    { category: "out", items: groups.outOfStock },
    { category: "soon", items: groups.soonToStockout },
    { category: "healthy", items: groups.healthy },
    { category: "dead", items: groups.deadStock },
    { category: "nodata", items: groups.insufficientData },
  ];

  let item: (typeof groups.outOfStock)[number] | undefined;
  let category: Category = "nodata";
  for (const bucket of buckets) {
    const found = bucket.items.find((f) => f.variantId === variantId);
    if (found) {
      item = found;
      category = bucket.category;
      break;
    }
  }

  // Ürün silinmiş/arşivlenmiş olabilir ya da variantId hatalı — panele dön.
  if (!item) throw redirect(`/app${locale ? `?locale=${locale}` : ""}`);

  const hasReorderSettings = shopSettings?.onboardedAt != null;
  const isSnoozed = snoozes.has(variantId);
  const snoozeUntil = snoozes.get(variantId) ?? null;

  return {
    locale,
    item,
    category,
    hasReorderSettings,
    isSnoozed,
    snoozeUntil: snoozeUntil ? snoozeUntil.toISOString() : null,
    suppliers,
    assignedSupplierId,
    showDetailsTour: !detailsTourSeen,
    isPaid: plan.tier === "paid",
    planUrl: plan.planUrl,
  };
};

const PAGE_CSS = `
.invf-pdp {
  max-width: 680px;
  margin: 0 auto;
  font-family: ${INVF_FONT_STACK};
}
.invf-pdp-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 700;
  color: #1A1A1A;
  text-decoration: none;
  margin-bottom: 16px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  transition: border-color 120ms ease, background 120ms ease;
}
.invf-pdp-back:hover { border-color: #008060; background: #F3FBF8; }
/* Ürün detay sayfasındaki diğer buton benzeri linkler (bkz.
   ProductAdvancedPanels.tsx: "Manage suppliers") — kullanıcı geri bildirimi:
   sade renkli metin linkleri tıklanabilir olduğu belli olmuyordu, artık her
   biri gerçek, kenarlıklı bir buton. */
.invf-pdp-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
  padding: 10px 15px;
  border-radius: 999px;
  white-space: nowrap;
}
.invf-pdp-btn--ghost {
  color: #0C5132;
  border: 1px solid #008060;
  background: #FFFFFF;
}
.invf-pdp-btn--ghost:hover { background: #E3F1DF; }
.invf-pdp-header {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #EBEBEB;
  margin-bottom: 4px;
}
/* Dar ekranda başlık uzun ürün isimlerinde 2-3 satıra sarınca, aynı
   satırdaki "Shopify'da görüntüle" butonu başlığa çok yakın/sıkışık
   duruyordu (kullanıcı geri bildirimi). Kendi tam genişlik satırına
   düşüyor, başlıkla arasına net bir boşluk giriyor. */
@media (max-width: 600px) {
  .invf-pdp-header a.invf-pdp-view-shopify {
    flex: 1 1 100%;
    margin-top: 4px;
    justify-content: center;
  }
}
.invf-pdp-title { font-size: 22px; font-weight: 800; color: #1A1A1A; overflow-wrap: anywhere; }
/* CellLabel ("STOK", "SATIŞ HIZI", "NE ZAMAN BİTER?") bu sayfada da
   kullanılıyor ama .invf-label kuralı SADECE panelin PAGE_CSS'inde vardı —
   burada hiç stil almıyor, altındaki değerle aynı puntoda düz metin olarak
   çıkıyordu. Panelin tamamını import edemeyiz: oradaki masaüstü kuralı
   (.invf-label için display:none) bu sayfada HER ZAMAN görünmesi gereken
   etiketleri gizlerdi. O yüzden sadece görünür/başlık hâli burada. */
.invf-label {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #757575;
}
.invf-pdp-variant { font-size: 14px; color: #6B6B6B; margin-top: 2px; }
.invf-pdp-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 20px;
}
.invf-pdp-stat {
  background: #FAFBFB;
  border: 1px solid #F0F0F0;
  border-radius: 10px;
  padding: 12px 14px;
}
/* "Ne zaman biter?" kutusu bilerek AYRI, tam genişlikte — 3 eşit sütuna
   sıkıştırılınca (eski hali) rozet + alt açıklama metni ("~X gün kaldı" +
   "X tarihinde" + "Y adet önerilir") üst üste biniyordu (kullanıcı geri
   bildirimi, ekran görüntüsüyle). Bu kutu diğer ikisinden çok daha fazla
   içerik taşıyor, tam genişliğe ihtiyacı var. */
.invf-pdp-runway {
  grid-column: 1 / -1;
  background: #FAFBFB;
  border: 1px solid #F0F0F0;
  border-radius: 10px;
  padding: 12px 14px;
}
${PRODUCT_CHARTS_CSS}
${RUNWAY_CELL_CSS}
${SNOOZE_CONTROL_CSS}
${PREMIUM_LOCK_CSS}
`;

export default function ProductDetailPage() {
  const { locale, item, category, hasReorderSettings, isSnoozed, snoozeUntil, suppliers, assignedSupplierId, showDetailsTour, isPaid, planUrl } =
    useLoaderData<typeof loader>();
  const t = getDictionary(locale);
  const categoryMeta = buildCategoryMeta(t);
  const meta = categoryMeta[category];
  const showVariant = item.variantTitle && item.variantTitle !== "Default Title";

  const reorderQty: number | null = hasReorderSettings ? item.suggestedReorderQty : null;
  const reorderByDays: number | null = hasReorderSettings ? item.reorderByDays : null;
  const reorderSettings = { leadTimeDays: item.effectiveLeadTimeDays, coverageDays: item.effectiveCoverageDays };

  return (
    <s-page heading={item.productTitle}>
      <style>{PAGE_CSS}</style>
      <div className="invf-pdp">
        <Link className="invf-pdp-back" to={`/app${locale ? `?locale=${locale}` : ""}`}>
          {t.settingsBackLink}
        </Link>

        <div className="invf-pdp-header">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", background: meta.soft, flexShrink: 0 }}
            />
          ) : (
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: meta.text,
                background: meta.soft,
              }}
            >
              {initials(item.productTitle)}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="invf-pdp-title">{item.productTitle}</div>
            {showVariant && <div className="invf-pdp-variant">{item.variantTitle}</div>}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <StatusPill category={category} categoryMeta={categoryMeta} />
              <SnoozeControl variantId={item.variantId} isSnoozed={isSnoozed} snoozeUntil={snoozeUntil} t={t} locale={locale} />
            </div>
          </div>
          <a
            href={`shopify://admin/products/${productAdminId(item.productId)}`}
            target="_top"
            className="invf-pdp-btn invf-pdp-btn--ghost invf-pdp-view-shopify"
            style={{ whiteSpace: "nowrap" }}
          >
            {t.viewInShopifyAdmin} ↗
          </a>
        </div>

        <div className="invf-pdp-stats">
          <div className="invf-pdp-stat">
            <CellLabel>{t.colStock}</CellLabel>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.available <= 0 ? "#D72C0D" : "#1A1A1A" }}>
              {item.available} <small style={{ fontSize: 13, fontWeight: 600, color: "#6B6B6B" }}>{t.stockUnit}</small>
            </div>
          </div>
          <div className="invf-pdp-stat">
            <CellLabel>{t.colRate}</CellLabel>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginTop: 4 }}>
              {rateText(item.dailyRate, t)}
              <TrendArrow trend={item.trend} t={t} />
            </div>
          </div>
          <div className="invf-pdp-runway">
            <CellLabel>{t.colRunway}</CellLabel>
            <div style={{ marginTop: 4 }}>
              {category === "out" ? (
                <span style={{ fontSize: 14, fontWeight: 700, color: "#D72C0D" }}>{t.outRunway}</span>
              ) : category === "soon" && item.stockoutInDays != null ? (
                <RunwayCell
                  days={Math.round(item.stockoutInDays)}
                  confidence={String(item.confidence ?? "")}
                  t={t}
                  locale={locale}
                  reorderQty={reorderQty}
                  reorderByDays={reorderByDays}
                />
              ) : category === "dead" ? (
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1F4C8C" }}>{t.deadRunway}</span>
              ) : (
                <span className="invf-muted">{t.noDataRunway}</span>
              )}
            </div>
          </div>
        </div>

        {/* Ucretsiz katmanda temel bilgi (stok, satis hizi, ne zaman biter)
            acik kaliyor; gelismis analiz premium. Boylece ucretsiz surum
            kullanisli ama eksik — kapali kapi yerine arkasinda ne oldugu
            anlatiliyor. */}
        {!isPaid && (
          <div style={{ marginTop: 20 }}>
            <PremiumLock description={t.premiumLockDetails} planUrl={planUrl} t={t} />
          </div>
        )}

        {isPaid && (
          <>
        <div id="invf-pdp-health">
          <HealthMeter score={item.healthScore} label={item.healthLabel} t={t} />
        </div>

        <div id="invf-pdp-charts">
          <SalesHistoryChart salesByDay={item.salesByDay} locale={locale} t={t} />
          <StockProjectionChart
            available={item.available}
            dailyRate={item.dailyRate}
            stockoutInDays={item.stockoutInDays}
            locale={locale}
            t={t}
          />
          <LocationBreakdown byLocation={item.byLocation} levelsTruncated={item.levelsTruncated} t={t} />
        </div>

        <div id="invf-pdp-supplier">
          <SupplierAssignment
            variantId={item.variantId}
            suppliers={suppliers}
            currentSupplierId={assignedSupplierId}
            hasCustomOverrideNoSupplier={Boolean(item.leadTimeOverridden)}
            t={t}
          />
        </div>

        <div id="invf-pdp-math">
        <TransparencyPanel
          available={item.available}
          dailyRate={item.dailyRate}
          salesByDay={item.salesByDay}
          leadTimeDays={item.effectiveLeadTimeDays}
          coverageDays={item.effectiveCoverageDays}
          suggestedReorderQty={item.suggestedReorderQty}
          t={t}
        />

        <WindowEstimatesTable
          salesByDay={item.salesByDay}
          available={item.available}
          settings={reorderSettings}
          locale={locale}
          t={t}
        />

        <SimulateGrowthCard
          dailyRate={item.dailyRate}
          available={item.available}
          settings={reorderSettings}
          locale={locale}
          t={t}
        />
        </div>
          </>
        )}
      </div>

      {showDetailsTour && <DetailsPageTour t={t} />}
    </s-page>
  );
}
