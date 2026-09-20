import type { CSSProperties } from "react";
import type { AlertTone } from "../../types/inventory";

type AlertBoxProps = {
  tone: AlertTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ALERT_TONES: { [K in AlertTone]: { accent: string; soft: string; text: string; icon: string } } =
{
  critical: { accent: "#D72C0D", soft: "#FFF1F0", text: "#8E1F0B", icon: "!" },
  warning: { accent: "#B98900", soft: "#FFF8E8", text: "#6B4700", icon: "!" },
  success: { accent: "#008060", soft: "#F1F8F4", text: "#0C5132", icon: "✓" },
};

export function AlertBox(props: AlertBoxProps) {
  const tone = ALERT_TONES[props.tone];
  const calm = props.tone === "success";

  const vars = {
    "--invf-alert-accent": tone.accent,
    "--invf-alert-soft": tone.soft,
    "--invf-alert-text": tone.text,
  } as CSSProperties;

  return (
    <div className={calm ? "invf-alert invf-alert--calm" : "invf-alert"} style={vars} role="status">
      <span className="invf-alert-icon" aria-hidden="true">
        {tone.icon}
      </span>
      <div className="invf-alert-body">
        <span className="invf-alert-title">{props.title}</span>
        {props.description && <span className="invf-alert-desc">{props.description}</span>}
      </div>
      {props.actionLabel && props.onAction && (
        <button type="button" className="invf-alert-btn" onClick={props.onAction}>
          {props.actionLabel}
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
