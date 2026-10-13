import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Dictionary } from "../../lib/translations";

// ---------------------------------------------------------------------------
// Satır içi tedarik süresi düzenleme (bkz. ifh_competitor_ideas: "inline,
// per-row editable lead time... pair with a global/default setting in a
// Settings screen, with per-SKU override inline"). Mağaza-geneli varsayılan
// app/settings sayfasında kalıyor — bu sadece TEK bir ürün için istisna.
//
// Kullanıcı geri bildirimi üzerine eklendi (önceki sürüm sessizce hiçbir
// şey yapmıyordu):
// - Eksi işareti YAZILAMIYOR (onChange'de anında filtreleniyor) — sadece
//   "min=1" HTML özniteliğine güvenmek yetmiyor, tarayıcı yine de kullanıcının
//   "-12" yazmasına izin veriyor, sadece görünmez bir "geçersiz" durumu
//   işaretliyor.
// - 1-365 aralığı dışına çıkan bir değerle blur olunca: SESSİZCE hiçbir şey
//   yapmak yerine kısa bir hata metni gösterip inputu son geçerli değere
//   geri döndürüyor.
// - Kaydederken görünür bir spinner, kaydettikten sonra kısa bir "✓ Kaydedildi"
//   onayı — önceden hiçbir geri bildirim yoktu, kullanıcı yazdığının
//   sisteme gidip gitmediğini bilemiyordu.
// ---------------------------------------------------------------------------

const MIN_DAYS = 1;
const MAX_DAYS = 365;
const SAVED_CONFIRMATION_MS = 1500;
const ERROR_MESSAGE_MS = 2200;

type LeadTimeInlineEditProps = {
  variantId: string;
  productTitle: string;
  effectiveLeadTimeDays: number;
  isOverridden: boolean;
  t: Dictionary;
};

export function LeadTimeInlineEdit(props: LeadTimeInlineEditProps) {
  const { variantId, productTitle, effectiveLeadTimeDays, isOverridden, t } = props;
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const [value, setValue] = useState(String(effectiveLeadTimeDays));
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const wasBusy = useRef(false);

  // Kullanıcı geri bildirimi: masaüstünde fareyle üzerine gelip ~1 saniye
  // beklenince açılsın (alışılmış tooltip davranışı), mobilde (dokunmatik,
  // hover kavramı yok) dokunma/tıklama ile açılıp kapansın. Konum, satırın
  // ekranın neresinde olduğuna göre JS ile hesaplanıyor — sabit yüzde/genişlik
  // ile ortalamak, dar bir kartın kenarına yakın satırlarda balonun ekran
  // dışına taşıp kesilmesine yol açıyordu (kullanıcı geri bildirimi).
  const [helpOpen, setHelpOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const POPOVER_WIDTH = 220;
  const POPOVER_GAP = 8;
  const SCREEN_EDGE_MARGIN = 12;

  function openHelp() {
    const iconEl = helpRef.current?.querySelector("button");
    if (!iconEl) return;
    const r = iconEl.getBoundingClientRect();
    const left = Math.min(
      Math.max(SCREEN_EDGE_MARGIN, r.left + r.width / 2 - POPOVER_WIDTH / 2),
      window.innerWidth - POPOVER_WIDTH - SCREEN_EDGE_MARGIN,
    );
    const spaceAbove = r.top;
    const placeAbove = spaceAbove > 90;
    const top = placeAbove ? r.top - POPOVER_GAP - 60 : r.bottom + POPOVER_GAP;
    setPopoverPos({ top: Math.max(SCREEN_EDGE_MARGIN, top), left });
    setHelpOpen(true);
  }

  function closeHelp() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHelpOpen(false);
  }

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(openHelp, 1000);
  }

  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHelpOpen(false);
  }

  useEffect(() => {
    if (!helpOpen) return;
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) closeHelp();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeHelp();
    }
    function handleReposition() {
      closeHelp();
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, { passive: true, capture: true });
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, { capture: true });
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpOpen]);

  // Sunucudan yeni bir effectiveLeadTimeDays geldiğinde (ör. mağaza
  // varsayılanı değişti ya da başka bir sekmeden override kaldırıldı)
  // input'u senkron tutuyoruz — kullanıcı o an başka bir değer YAZIYORSA
  // (fetcher meşgulse) üzerine yazmıyoruz.
  useEffect(() => {
    if (!busy) setValue(String(effectiveLeadTimeDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLeadTimeDays]);

  // busy -> idle geçişini yakalayıp kısa bir "✓ Kaydedildi" onayı gösteriyor.
  useEffect(() => {
    if (wasBusy.current && !busy && fetcher.data && (fetcher.data as { ok?: boolean }).ok) {
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), SAVED_CONFIRMATION_MS);
      return () => clearTimeout(timer);
    }
    wasBusy.current = busy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function submit(nextValue: string) {
    fetcher.submit(
      { variantId, leadTimeDays: nextValue },
      { method: "post", action: "/app/leadTimeOverride" },
    );
  }

  function showError(message: string) {
    setError(message);
    setValue(String(effectiveLeadTimeDays));
    setTimeout(() => setError(null), ERROR_MESSAGE_MS);
  }

  function handleBlur() {
    if (value === String(effectiveLeadTimeDays)) return;
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) {
      showError(t.inlineLeadTimeInvalid(MIN_DAYS, MAX_DAYS));
      return;
    }
    if (n < MIN_DAYS || n > MAX_DAYS) {
      showError(t.inlineLeadTimeOutOfRange(MIN_DAYS, MAX_DAYS));
      return;
    }
    submit(String(Math.round(n)));
  }

  return (
    <div className="invf-leadtime-inline">
      <span className="invf-leadtime-label">{t.inlineLeadTimeLabel}</span>
      {/* Kullanıcı geri bildirimi: mağaza sahibi bu alanı ilk gördüğünde
          "30 de ne demek?" diye düşünüyor — her satırda kalıcı bir
          açıklama metni eklemek (249 satırda) çok yer kaplardı, bunun
          yerine tıklayınca/dokununca kısa bir açıklama çıkan bir bilgi
          ikonu yeterli. */}
      <div
        className="invf-leadtime-help-wrap"
        ref={helpRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          className="invf-leadtime-help"
          onClick={() => (helpOpen ? closeHelp() : openHelp())}
          aria-label={t.inlineLeadTimeTooltip}
          aria-expanded={helpOpen}
        >
          i
        </button>
        {helpOpen && popoverPos && (
          <div
            className="invf-leadtime-help-popover"
            role="tooltip"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            {t.inlineLeadTimeTooltip}
          </div>
        )}
      </div>
      <input
        type="number"
        min={MIN_DAYS}
        max={MAX_DAYS}
        className={error ? "invf-leadtime-input invf-leadtime-input--error" : "invf-leadtime-input"}
        value={value}
        disabled={busy}
        aria-label={t.inlineLeadTimeAriaLabel(productTitle)}
        aria-invalid={error != null}
        onChange={(e) => {
          // Eksi işareti / harf / ondalık ayırıcı hiç YAZILAMASIN — "min"
          // HTML özniteliği tek başına bunu engellemiyor, tarayıcı yine de
          // "-12" yazılmasına izin verip sadece görünmez bir geçersizlik
          // bayrağı koyuyor.
          setValue(e.target.value.replace(/[^0-9]/g, ""));
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="invf-leadtime-suffix">{t.inlineLeadTimeSuffix}</span>

      {busy && <span className="invf-leadtime-spinner" aria-hidden="true" />}
      {!busy && justSaved && <span className="invf-leadtime-saved">✓ {t.inlineLeadTimeSaved}</span>}

      {isOverridden && !busy && !justSaved && (
        <>
          <span className="invf-leadtime-badge">{t.inlineLeadTimeCustomBadge}</span>
          <button
            type="button"
            className="invf-leadtime-reset"
            disabled={busy}
            onClick={() => submit("")}
          >
            {t.inlineLeadTimeResetLabel}
          </button>
        </>
      )}

      {error && <span className="invf-leadtime-error">{error}</span>}
    </div>
  );
}
