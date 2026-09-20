import type { ReactNode } from "react";
import type { Dictionary, Locale } from "../../lib/translations";
import type { Trend } from "../../lib/forecast";
import type { Category, CategoryMetaMap } from "../../types/inventory";
import { confidenceText, stockoutDateText } from "../../lib/inventory/format";

// ---------------------------------------------------------------------------
// Küçük parçalar
// ---------------------------------------------------------------------------

export function StatusPill(props: { category: Category; categoryMeta: CategoryMetaMap }) {
  const meta = props.categoryMeta[props.category];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        color: meta.text,
        background: meta.soft,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: meta.accent }} />
      {meta.label}
    </span>
  );
}

export function CellLabel(props: { children: ReactNode }) {
  return <span className="invf-label">{props.children}</span>;
}

// Son 7 gün / önceki 7 gün karşılaştırmasına dayanan basit trend oku.
// Yeterli veri yoksa (trend null) hiçbir şey render etmiyor.
const TREND_STYLE: { [K in Trend]: { arrow: string; color: string } } = {
  up: { arrow: "↑", color: "#0C5132" },
  down: { arrow: "↓", color: "#B98900" },
  flat: { arrow: "→", color: "#6B6B6B" },
};

export function TrendArrow(props: { trend: Trend | null; t: Dictionary }) {
  if (!props.trend) return null;
  const { arrow, color } = TREND_STYLE[props.trend];
  const label = {
    up: props.t.trendUpLabel,
    down: props.t.trendDownLabel,
    flat: props.t.trendFlatLabel,
  }[props.trend];

  return (
    <span
      style={{ marginLeft: 6, fontWeight: 800, color }}
      title={label}
      aria-label={label}
    >
      {arrow}
    </span>
  );
}

export function RunwayCell(props: {
  days: number;
  confidence: string;
  t: Dictionary;
  locale: Locale;
  // Sipariş ayarları yapılmışsa dolu, yoksa null (bkz. ProductRow.tsx).
  reorderQty?: number | null;
  reorderByDays?: number | null;
}) {
  const { days, t, locale, reorderQty, reorderByDays } = props;
  const note = confidenceText(props.confidence, t);

  // Tedarik süresi ayarlandıysa: önerilen miktar + (varsa) "süre geçti"
  // uyarısı. İkisi de RunwayCell'in iki dalı (bugün / gelecek bir gün)
  // arasında ortak, tekrar yazmamak için burada tek seferlik hazırlanıyor.
  const reorderInfo = (
    <>
      {reorderQty != null && reorderQty > 0 && (
        <span className="invf-sub">{t.reorderQtySuggestion(reorderQty)}</span>
      )}
      {reorderByDays != null && reorderByDays <= 0 && (
        <span className="invf-note" style={{ color: "#C4210B" }}>
          {t.reorderOverdueNote}
        </span>
      )}
    </>
  );

  // 0 güne yuvarlanan tahmin "≈0 gün sonra" olarak okunuyordu; düz cümleye çevrildi.
  if (days <= 0) {
    return (
      <div>
        <span className="invf-days-chip" style={{ background: "#FEE9E8", color: "#C4210B" }}>
          {t.runwayToday}
        </span>
        {note && <span className="invf-note">{note}</span>}
        {reorderInfo}
      </div>
    );
  }

  const bg = days <= 7 ? "#FEE9E8" : days <= 21 ? "#FFF4E0" : "#E3F1DF";
  const fg = days <= 7 ? "#C4210B" : days <= 21 ? "#8A5A00" : "#0C5132";

  return (
    <div>
      <span className="invf-days-chip" style={{ background: bg, color: fg }}>
        ≈{days}
        <small>{t.runwayDaysSuffix}</small>
      </span>
      <span className="invf-sub">{t.runwayAround(stockoutDateText(days, locale))}</span>
      {note && <span className="invf-note">{note}</span>}
      {reorderInfo}
    </div>
  );
}
