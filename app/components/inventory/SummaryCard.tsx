import type { CSSProperties } from "react";
import type { Category, CategoryMetaMap } from "../../types/inventory";
import { CardStripe } from "./CardStripe";

// ---------------------------------------------------------------------------
// Özet kartı (tıklanınca listeyi filtreler)
// ---------------------------------------------------------------------------

type SummaryCardProps = {
  category: Category;
  count: number;
  active: boolean;
  categoryMeta: CategoryMetaMap;
  onClick: () => void;
};

export function SummaryCard(props: SummaryCardProps) {
  const meta = props.categoryMeta[props.category];
  // Sayısı 0 olan kart tıklanınca boş listeye düşürüyordu; tıklanamaz yapıldı.
  const empty = props.count === 0;

  const accentVar = { "--invf-card-accent": meta.accent } as CSSProperties;

  const style: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    cursor: empty ? "default" : "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "14px 14px 12px",
    borderRadius: 12,
    background: props.active ? meta.soft : "#FFFFFF",
    border: props.active ? `2px solid ${meta.accent}` : "1px solid #E3E3E3",
    opacity: empty ? 0.55 : 1,
    fontFamily: "inherit",
    minWidth: 0,
    ...accentVar,
  };

  const className = [
    "invf-summary-card",
    props.active ? "invf-summary-card--active" : "",
    empty ? "invf-summary-card--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={empty ? undefined : props.onClick}
      aria-pressed={props.active}
      aria-disabled={empty}
    >
      <CardStripe color={empty ? "#DCDCDC" : meta.accent} />
      <span style={{ fontSize: 13, fontWeight: 700, color: empty ? "#6B6B6B" : meta.text }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A" }}>
        {props.count}
      </span>
      <span style={{ fontSize: 12, color: "#5C5C5C", lineHeight: 1.35 }}>{meta.hint}</span>
    </button>
  );
}
