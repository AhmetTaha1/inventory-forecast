import type { CSSProperties } from "react";
import type { Dictionary } from "../../lib/translations";
import { ALL_PRODUCTS_ACCENT } from "../../lib/inventory/constants";
import { CardStripe } from "./CardStripe";

// ---------------------------------------------------------------------------
// "Tüm ürünler" kartı — diğer kartlarla aynı görsel dil, geniş/yatay
// ---------------------------------------------------------------------------

type AllProductsCardProps = {
  count: number;
  showingAll: boolean;
  t: Dictionary;
  onClick: () => void;
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "14px 18px 12px",
    borderRadius: 12,
    background: props.showingAll ? "#F1F8F4" : "#FFFFFF",
    border: props.showingAll ? `2px solid ${ALL_PRODUCTS_ACCENT}` : "1px solid #E3E3E3",
    fontFamily: "inherit",
    ...accentVar,
  };

  return (
    <button
      type="button"
      className="invf-summary-card invf-allcard"
      style={style}
      onClick={props.onClick}
      aria-pressed={props.showingAll}
    >
      <CardStripe color={ALL_PRODUCTS_ACCENT} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{t.allProductsTitle}</span>
        <span style={{ fontSize: 12.5, color: "#6B6B6B" }}>
          {props.showingAll ? t.allProductsShowingAll : t.allProductsClearFilter}
        </span>
      </div>
      {/* Diğer kartlardaki büyük/kalın/siyah sayı stiliyle birebir aynı —
          önceki sürümde yeşil rozet içindeydi, tutarsız duruyordu. */}
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A", flexShrink: 0 }}>
        {props.count}
      </span>
    </button>
  );
}
