import type { CSSProperties } from "react";
import type { Dictionary } from "../../lib/translations";
import { ALL_PRODUCTS_ACCENT } from "../../lib/inventory/constants";
import { CardStripe } from "./CardStripe";

// ---------------------------------------------------------------------------
// "Tüm ürünler" kartı — SummaryCard ile birebir aynı yapı (başlık, büyük
// sayı, açıklama; hepsi üst-solda). Önceden "geniş/yatay" ayrı bir düzeni
// vardı (başlık solda, sayı sağda) ve yanındaki "Stok yeterli" kartıyla
// uyumsuz duruyordu; kullanıcı geri bildirimiyle aynı dile çekildi.
// ---------------------------------------------------------------------------

type AllProductsCardProps = {
  count: number;
  showingAll: boolean;
  t: Dictionary;
  onClick: () => void;
  // Satırda tek başına kalırsa (yanında başka kart yoksa) tüm sütunlara yayılır.
  fullWidth?: boolean;
};

export function AllProductsCard(props: AllProductsCardProps) {
  const { t } = props;
  const accentVar = { "--invf-card-accent": ALL_PRODUCTS_ACCENT } as CSSProperties;

  const style: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "14px 14px 12px",
    borderRadius: 12,
    background: props.showingAll ? "#F1F8F4" : "#FFFFFF",
    border: props.showingAll ? `2px solid ${ALL_PRODUCTS_ACCENT}` : "1px solid #E3E3E3",
    fontFamily: "inherit",
    minWidth: 0,
    gridColumn: props.fullWidth ? "1 / -1" : undefined,
    ...accentVar,
  };

  return (
    <button
      type="button"
      className="invf-summary-card"
      style={style}
      onClick={props.onClick}
      aria-pressed={props.showingAll}
    >
      <CardStripe color={ALL_PRODUCTS_ACCENT} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0C5132" }}>{t.allProductsTitle}</span>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A" }}>
        {props.count}
      </span>
      <span style={{ fontSize: 12, color: "#5C5C5C", lineHeight: 1.35 }}>
        {props.showingAll ? t.allProductsShowingAll : t.allProductsClearFilter}
      </span>
    </button>
  );
}
