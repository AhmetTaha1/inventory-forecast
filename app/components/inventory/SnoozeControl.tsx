import { useFetcher } from "react-router";
import type { Dictionary, Locale } from "../../lib/translations";
import { absoluteDateText } from "../../lib/inventory/format";

// ---------------------------------------------------------------------------
// Ertele / ertelemeyi kaldır — satır bazlı, kalıcı "mute" değil.
// ---------------------------------------------------------------------------
// Erteli değilse: bir <select> ile hızlı süre seçimi (seçince hemen
// gönderiliyor, ayrı bir "Uygula" butonuna gerek yok). Erteliyse: ne zamana
// kadar ertelendiğini gösterip "Ertelemeyi kaldır" seçeneği sunuyor.
// fetcher.Form kullanıldığı için sayfa yenilenmiyor, sadece loader verisi
// tazeleniyor (bkz. app/routes/app.snooze.tsx).

type SnoozeControlProps = {
  variantId: string;
  isSnoozed: boolean;
  snoozeUntil: Date | string | null;
  t: Dictionary;
  locale: Locale;
};

export function SnoozeControl(props: SnoozeControlProps) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const { t } = props;

  if (props.isSnoozed) {
    const untilText = props.snoozeUntil
      ? t.snoozedUntilLabel(absoluteDateText(new Date(props.snoozeUntil), props.locale))
      : t.snoozedIndefiniteLabel;

    return (
      <fetcher.Form method="post" action="/app/snooze">
        <input type="hidden" name="variantId" value={props.variantId} />
        <input type="hidden" name="action" value="unsnooze" />
        <div className="invf-snooze-info">
          <span>{untilText}</span>
          <button type="submit" className="invf-snooze-unsnooze" disabled={busy}>
            {t.unsnoozeButton}
          </button>
        </div>
      </fetcher.Form>
    );
  }

  return (
    <fetcher.Form method="post" action="/app/snooze">
      <input type="hidden" name="variantId" value={props.variantId} />
      <select
        name="action"
        defaultValue=""
        disabled={busy}
        className="invf-snooze-select"
        aria-label={t.snoozeSelectAriaLabel}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="" disabled>
          {t.snoozePlaceholder}
        </option>
        <option value="7">{t.snooze7Days}</option>
        <option value="30">{t.snooze30Days}</option>
        <option value="90">{t.snooze90Days}</option>
        <option value="indefinite">{t.snoozeIndefinite}</option>
      </select>
    </fetcher.Form>
  );
}
