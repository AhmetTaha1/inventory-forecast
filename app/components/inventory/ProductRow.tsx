import type { ReactNode } from "react";
import type { Dictionary, Locale } from "../../lib/translations";
import type { Category, CategoryMetaMap } from "../../types/inventory";
import { initials, productAdminId, rateText } from "../../lib/inventory/format";
import { CellLabel, RunwayCell, StatusPill } from "./Cells";

type ProductRowProps = {
  item: any;
  category: Category;
  categoryMeta: CategoryMetaMap;
  t: Dictionary;
  locale: Locale;
};

export function ProductRow({ item, category, categoryMeta, t, locale }: ProductRowProps) {
  const meta = categoryMeta[category];

  let runway: ReactNode;
  if (category === "out") {
    runway = (
      <span style={{ fontSize: 14, fontWeight: 700, color: "#D72C0D" }}>{t.outRunway}</span>
    );
  } else if (category === "soon" && item.stockoutInDays != null) {
    runway = (
      <RunwayCell
        days={Math.round(item.stockoutInDays)}
        confidence={String(item.confidence ?? "")}
        t={t}
        locale={locale}
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
            width={36}
            height={36}
            loading="lazy"
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 9,
              objectFit: "cover",
              background: meta.soft,
            }}
          />
        ) : (
          <span
            style={{
              width: 36,
              height: 36,
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
        </span>
      </div>

      <div className="invf-wide">
        <CellLabel>{t.colRunway}</CellLabel>
        {runway}
      </div>
    </div>
  );
}
