import type { ReactNode } from "react";
import type { Dictionary, Locale } from "../../lib/translations";
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

export function RunwayCell(props: { days: number; confidence: string; t: Dictionary; locale: Locale }) {
  const { days, t, locale } = props;
  const note = confidenceText(props.confidence, t);

  // 0 güne yuvarlanan tahmin "≈0 gün sonra" olarak okunuyordu; düz cümleye çevrildi.
  if (days <= 0) {
    return (
      <div>
        <span className="invf-days-chip" style={{ background: "#FEE9E8", color: "#C4210B" }}>
          {t.runwayToday}
        </span>
        {note && <span className="invf-note">{note}</span>}
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
    </div>
  );
}
