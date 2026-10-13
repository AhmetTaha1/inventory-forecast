import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Dictionary, Locale } from "../../lib/translations";
import type { Category, CategoryMetaMap } from "../../types/inventory";
import { absoluteDateText, initials, productAdminId, rateText } from "../../lib/inventory/format";
import { CellLabel, RunwayCell, StatusPill, TrendArrow } from "./Cells";
import { LeadTimeInlineEdit } from "./LeadTimeInlineEdit";

type ProductRowProps = {
  item: any;
  category: Category;
  categoryMeta: CategoryMetaMap;
  t: Dictionary;
  locale: Locale;
  // Sipariş ayarları (tedarik süresi) hiç yapılmamışsa false — bu durumda
  // hiç ayarlanmamış varsayılan değerlere göre üretilmiş öneriler
  // gösterilmiyor (bkz. app._index.tsx loader'daki hasReorderSettings notu).
  showReorderSuggestion: boolean;
  // true ise bu satır "Ertelenmiş ürünler" görünümünde — sadece bilgi
  // amaçlı bir "ne zamana kadar ertelendi" notu gösteriyoruz; ertelemeyi
  // yönetmek (kaldırmak/uzatmak) artık ürün detay sayfasında (bkz.
  // app.product.$variantId.tsx) — satır artık interaktif bir <select>
  // taşımıyor, kullanıcı geri bildirimi üzerine (durum sütunu 3 farklı
  // özelliğin üst üste yığıldığı, karmaşık/sıkışık bir yer haline gelmişti).
  isSnoozed: boolean;
  snoozeUntil: Date | string | null;
};

export function ProductRow({
  item,
  category,
  categoryMeta,
  t,
  locale,
  showReorderSuggestion,
  isSnoozed,
  snoozeUntil,
}: ProductRowProps) {
  const meta = categoryMeta[category];

  const reorderQty: number | null = showReorderSuggestion ? item.suggestedReorderQty : null;
  const reorderByDays: number | null = showReorderSuggestion ? item.reorderByDays : null;

  let runway: ReactNode;
  if (category === "out") {
    runway = (
      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#D72C0D" }}>{t.outRunway}</span>
        {reorderQty != null && reorderQty > 0 && (
          <span className="invf-sub">{t.reorderQtySuggestion(reorderQty)}</span>
        )}
      </div>
    );
  } else if (category === "soon" && item.stockoutInDays != null) {
    runway = (
      <RunwayCell
        days={Math.round(item.stockoutInDays)}
        confidence={String(item.confidence ?? "")}
        t={t}
        locale={locale}
        reorderQty={reorderQty}
        reorderByDays={reorderByDays}
        reorderQtyLocked={Boolean(item.reorderQtyLocked)}
      />
    );
  } else if (category === "dead") {
    runway = (
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1F4C8C" }}>{t.deadRunway}</span>
    );
  } else {
    runway = <span className="invf-muted">{t.noDataRunway}</span>;
  }

  const showVariant = item.variantTitle && item.variantTitle !== "Default Title";
  const isOut = item.available <= 0;
  // item.variantId Shopify'ın tam GID'i ("gid://shopify/ProductVariant/123") —
  // içinde "/" karakterleri olduğu için ÇÖZÜLMEMİŞ haliyle tek bir rota
  // segmentine konulunca 404'e yol açıyordu (URL, kastedilenden fazla
  // segmente bölünüyordu). encodeURIComponent tek bir segment garantiliyor;
  // react-router parametreleri otomatik decode ettiği için loader'da
  // (app.product.$variantId.tsx) params.variantId yine orijinal GID olarak gelir.
  const detailsHref = `/app/product/${encodeURIComponent(item.variantId)}${locale ? `?locale=${locale}` : ""}`;

  return (
    <div className="invf-row" style={{ borderLeft: `3px solid ${meta.accent}` }}>
      {/* Gerçek Shopify ürün sayfasına link. "shopify://" App Bridge'in
          kendi navigasyon protokolü — düz <a href="/..."> DEĞİL, bu
          yüzden "kendi rotalarımız için Link kullan" kuralının dışında:
          uygulamamızın dışına, Shopify'ın native sayfasına çıkıyor.
          target="_top" şart, aksi halde iframe içinde açmayı dener. */}
      <a
        className="invf-product"
        href={`shopify://admin/products/${productAdminId(item.productId)}`}
        target="_top"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 9,
              objectFit: "cover",
              background: meta.soft,
            }}
          />
        ) : (
          <span
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 9,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12.5,
              fontWeight: 700,
              color: meta.text,
              background: meta.soft,
            }}
          >
            {initials(item.productTitle)}
          </span>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span className="invf-product-title" style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
            {item.productTitle}
          </span>
          {showVariant && (
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "#6B6B6B" }}>
              {item.variantTitle}
            </span>
          )}
        </div>
      </a>

      <div className="invf-c-status">
        <CellLabel>{t.colStatus}</CellLabel>
        <StatusPill category={category} categoryMeta={categoryMeta} />
        <Link to={detailsHref} className="invf-details-btn">
          {t.detailsLinkLabel} →
        </Link>
        {/* Rozet + "Detaylar" arasında BİLEREK sonra geliyor — mobilde
            (bkz. styles.ts .invf-c-status: flex-wrap) DOM sırası flex
            satırlarının nasıl bölüneceğini belirliyor: rozet+buton her
            zaman aynı ilk satırda kalsın, not (varsa) kendi satırına
            düşsün diye en sonda. */}
        {isSnoozed && (
          <span className="invf-snoozed-until-note">
            {snoozeUntil ? t.snoozedUntilLabel(absoluteDateText(new Date(snoozeUntil), locale)) : t.snoozedIndefiniteLabel}
          </span>
        )}
      </div>

      <div className="invf-c-stock">
        <CellLabel>{t.colStock}</CellLabel>
        <span className="invf-num" style={{ color: isOut ? "#D72C0D" : "#1A1A1A" }}>
          {item.available}
          <small>{t.stockUnit}</small>
        </span>
      </div>

      <div className="invf-c-rate">
        <CellLabel>{t.colRate}</CellLabel>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1A1A" }}>
          {rateText(item.dailyRate, t)}
          <TrendArrow trend={item.trend} t={t} />
        </span>
      </div>

      <div className="invf-wide">
        <CellLabel>{t.colRunway}</CellLabel>
        {runway}
        <LeadTimeInlineEdit
          variantId={item.variantId}
          productTitle={item.productTitle}
          effectiveLeadTimeDays={item.effectiveLeadTimeDays}
          isOverridden={Boolean(item.leadTimeOverridden)}
          t={t}
        />
      </div>
    </div>
  );
}
