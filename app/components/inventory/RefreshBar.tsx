import type { CSSProperties } from "react";
import type { Dictionary } from "../../lib/translations";
import { dimStyle } from "../../lib/inventory/format";

// ---------------------------------------------------------------------------
// Üst şerit: yenile butonu + son güncelleme
// ---------------------------------------------------------------------------

type RefreshBarProps = {
  lastUpdated: string;
  isRefreshing: boolean;
  justRefreshed: boolean;
  t: Dictionary;
  onRefresh: () => void;
};

export function RefreshBar(props: RefreshBarProps) {
  const { t } = props;
  const buttonStyle: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: props.isRefreshing ? "wait" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 10,
    background: props.isRefreshing ? "#4F9E86" : "#008060",
    color: "#FFFFFF",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
  };

  const iconStyle: CSSProperties = {
    display: "inline-block",
    fontSize: 16,
    lineHeight: 1,
    animation: props.isRefreshing ? "invf-spin 0.9s linear infinite" : "none",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "13px 16px",
        borderRadius: 12,
        background: "#FFFFFF",
        border: "1px solid #E3E3E3",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: 2, ...dimStyle(props.isRefreshing) }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
          {t.refreshSubtitle}
        </span>
        <span style={{ fontSize: 12.5, color: "#6B6B6B" }}>
          {t.lastUpdatedPrefix}
          {props.lastUpdated}
          {props.justRefreshed && !props.isRefreshing && (
            <span style={{ marginLeft: 8, fontWeight: 600, color: "#008060" }}>
              {t.justRefreshed}
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        className="invf-refresh-btn"
        style={buttonStyle}
        onClick={props.onRefresh}
        disabled={props.isRefreshing}
      >
        <span style={iconStyle}>↻</span>
        {props.isRefreshing ? t.refreshing : t.refreshButton}
      </button>
    </div>
  );
}
