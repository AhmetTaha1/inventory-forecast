import type { CSSProperties } from "react";
import type { Dictionary } from "../../lib/translations";
import { CardStripe } from "./CardStripe";

// ---------------------------------------------------------------------------
// "En çok satanlar" kartı — kullanıcı geri bildirimi: panel HEP sorunları
// gösteriyordu (tükendi/azalıyor/ölü stok), iyi giden ürünleri hiç
// göstermiyordu. Bu kart tıklanınca listeyi en yüksek satış hızına sahip
// ürünlere filtreliyor.
//
// Düzen SummaryCard ile birebir aynı (başlık, büyük sayı, açıklama; hepsi
// üst-solda). Renk ailesi BİLEREK ayrı: kategori kartlarının "sorun" tonları
// yerine sıcak altın — bu kartın işi "uyarı" değil "kutlama".
// ---------------------------------------------------------------------------

const TOP_SELLERS_ACCENT = "#B8860B"; // koyu altın — marka yeşilinden ve durum renklerinden ayrışıyor

type TopSellersCardProps = {
  count: number;
  active: boolean;
  t: Dictionary;
  onClick: () => void;
};

export function TopSellersCard(props: TopSellersCardProps) {
  const { t } = props;
  const empty = props.count === 0;
  const accentVar = { "--invf-card-accent": TOP_SELLERS_ACCENT } as CSSProperties;

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
    background: props.active ? "#FFF8E7" : "#FFFFFF",
    border: props.active ? `2px solid ${TOP_SELLERS_ACCENT}` : "1px solid #E3E3E3",
    opacity: empty ? 0.55 : 1,
    fontFamily: "inherit",
    minWidth: 0,
    ...accentVar,
  };

  return (
    <button
      type="button"
      className="invf-summary-card"
      style={style}
      onClick={empty ? undefined : props.onClick}
      aria-pressed={props.active}
      aria-disabled={empty}
    >
      <CardStripe color={empty ? "#DCDCDC" : TOP_SELLERS_ACCENT} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#7A5100" }}>{t.topSellersCardTitle}</span>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A" }}>
        {props.count}
      </span>
      <span style={{ fontSize: 12, color: "#5C5C5C", lineHeight: 1.35 }}>{t.topSellersCardHint}</span>
    </button>
  );
}
