import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { useFetcher } from "react-router";
import type { Dictionary } from "../lib/translations";

// ---------------------------------------------------------------------------
// Karşılama turu — SADECE ilk açılışta gösterilir, bir daha asla çıkmaz.
// ---------------------------------------------------------------------------
// Önceki sürüm ortada, hiçbir şeye bağlı olmayan düz bir kartti — "sahipsiz"
// duruyordu (kullanıcı geri bildirimi). Artık gerçek bir "spot ışığı" turu:
// ilgili alanı (özet kartları, ürün listesi, ayarlar linki) CSS'in
// box-shadow hilesiyle (küçük, saydam bir kutunun devasa gölgesi etrafını
// karartıyor) aydınlatıp yanına konumlanmış bir açıklama balonu koyuyor.
// Sadece ilk adımda ("Hoş geldiniz") işaret edilecek tek bir eleman
// olmadığı için ortada duruyor — bu, bilinçli tek istisna.

type Step = {
  selector: string | null; // null = ortada (sadece ilk adım)
  title: string;
  desc: string;
};

function buildSteps(t: Dictionary): Step[] {
  return [
    { selector: null, title: t.tourStep1Title, desc: t.tourStep1Desc },
    { selector: ".invf-summary", title: t.tourStep2Title, desc: t.tourStep2Desc },
    { selector: ".invf-list-card", title: t.tourStep3Title, desc: t.tourStep3Desc },
    { selector: ".invf-settings-link", title: t.tourStep4Title, desc: t.tourStep4Desc },
  ];
}

const SPOTLIGHT_PADDING = 10;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 16;

type Rect = { top: number; left: number; width: number; height: number };

const TOUR_CSS = `
.invf-tour-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 15, 0.55);
  z-index: 300;
}
.invf-tour-spotlight {
  position: fixed;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(15, 15, 15, 0.55);
  border: 2px solid #FFFFFF;
  z-index: 300;
  pointer-events: none;
  transition: top 250ms ease, left 250ms ease, width 250ms ease, height 250ms ease;
}
.invf-tour-tooltip {
  position: fixed;
  width: ${TOOLTIP_WIDTH}px;
  background: #FFFFFF;
  border-radius: 14px;
  padding: 20px 20px 16px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.35);
  z-index: 301;
  transition: top 250ms ease, left 250ms ease;
}
.invf-tour-tooltip--centered {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.invf-tour-skip {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  top: 12px;
  right: 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #6B6B6B;
  padding: 4px 7px;
  border-radius: 6px;
}
.invf-tour-skip:hover { background: #F1F1F1; color: #1A1A1A; }
.invf-tour-icon { font-size: 32px; margin-bottom: 10px; }
.invf-tour-title { font-size: 16px; font-weight: 800; color: #1A1A1A; margin-bottom: 6px; padding-right: 20px; }
.invf-tour-tooltip--centered .invf-tour-title { padding-right: 0; font-size: 18px; }
.invf-tour-desc { font-size: 13.5px; color: #5C5C5C; line-height: 1.5; margin-bottom: 16px; }
.invf-tour-dots { display: flex; gap: 6px; margin-bottom: 16px; }
.invf-tour-tooltip--centered .invf-tour-dots { justify-content: center; }
.invf-tour-dot { width: 6px; height: 6px; border-radius: 999px; background: #E3E3E3; }
.invf-tour-dot--active { background: #008060; width: 18px; }
.invf-tour-actions { display: flex; align-items: center; gap: 10px; }
.invf-tour-tooltip--centered .invf-tour-actions { justify-content: center; }
.invf-tour-prev {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 9px 16px;
  border-radius: 9px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-tour-prev:hover { background: #F7F7F7; }
.invf-tour-next {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 9px 20px;
  border-radius: 9px;
  background: #008060;
  color: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}
.invf-tour-next:hover { background: #026B4F; }
`;

export function WelcomeTour(props: { t: Dictionary }) {
  const { t } = props;
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const fetcher = useFetcher();

  const steps = buildSteps(t);
  const current = steps[step];

  // Hedef elemanı ekrana kaydırıp konumunu ölçüyor. Pencere yeniden
  // boyutlandırılırsa ya da (istemeden) kaydırılırsa da güncel kalıyor.
  useLayoutEffect(() => {
    if (!current.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    function measure() {
      const r = el!.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    // Smooth scroll'un oturması için kısa bir gecikme + devam eden ölçüm.
    const settleTimer = setTimeout(measure, 350);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Esc ile kapatma — FeedbackButton.tsx'teki aynı desen. Arka plana
  // tıklayınca kapanma da var (asağıda), ikisi birlikte klavye
  // kullanıcılarının da turu kapatabilmesini sağlıyor.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dismissed) return null;

  const isLast = step === steps.length - 1;

  function close() {
    fetcher.submit(null, { method: "post", action: "/app/tour" });
    setDismissed(true);
  }

  // Tooltip'i hedefin altına, sığmıyorsa üstüne yerleştiriyor; yatayda
  // ekran dışına taşmayacak şekilde kırpıyor.
  let tooltipStyle: CSSProperties = {};
  if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > 200;
    const top = placeBelow
      ? rect.top + rect.height + TOOLTIP_GAP
      : Math.max(16, rect.top - TOOLTIP_GAP - 220);
    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - TOOLTIP_WIDTH - 16,
    );
    tooltipStyle = { top, left };
  }

  const body = (
    <>
      <button type="button" className="invf-tour-skip" onClick={close}>
        {t.tourSkip}
      </button>
      {!current.selector && <div className="invf-tour-icon" aria-hidden="true">👋</div>}
      <div className="invf-tour-title">{current.title}</div>
      <div className="invf-tour-desc">{current.desc}</div>
      <div className="invf-tour-dots" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={i === step ? "invf-tour-dot invf-tour-dot--active" : "invf-tour-dot"} />
        ))}
      </div>
      <div className="invf-tour-actions">
        {step > 0 && (
          <button type="button" className="invf-tour-prev" onClick={() => setStep((s) => s - 1)}>
            {t.tourPrev}
          </button>
        )}
        <button
          type="button"
          className="invf-tour-next"
          onClick={() => (isLast ? close() : setStep((s) => s + 1))}
        >
          {isLast ? t.tourFinish : t.tourNext}
        </button>
      </div>
    </>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={t.tourAriaLabel}>
      <style>{TOUR_CSS}</style>
      <div className="invf-tour-backdrop" onClick={close} />
      {rect && (
        <div
          className="invf-tour-spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}
      <div
        className={current.selector ? "invf-tour-tooltip" : "invf-tour-tooltip invf-tour-tooltip--centered"}
        style={current.selector ? tooltipStyle : undefined}
      >
        {body}
      </div>
    </div>
  );
}
