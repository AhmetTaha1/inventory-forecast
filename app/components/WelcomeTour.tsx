import { useState } from "react";
import { useFetcher } from "react-router";
import type { Dictionary } from "../lib/translations";

// ---------------------------------------------------------------------------
// Karşılama turu — SADECE ilk açılışta gösterilir, bir daha asla çıkmaz.
// ---------------------------------------------------------------------------
// "Bitir"/"Atla" tıklanınca hem yerel state'i (dismissed) ANINDA günceller
// (kullanıcı beklemesin) hem de app/routes/app.tour.tsx'e bir fetcher POST'u
// atıp sunucu tarafında kalıcı olarak işaretler (bkz. shopSettings.server.ts).

const TOUR_CSS = `
.invf-tour-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 300;
}
.invf-tour-panel {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 32px 28px 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  text-align: center;
}
.invf-tour-skip {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  top: 14px;
  right: 16px;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: #6B6B6B;
  padding: 4px 8px;
  border-radius: 6px;
}
.invf-tour-skip:hover { background: #F1F1F1; color: #1A1A1A; }
.invf-tour-icon { font-size: 40px; margin-bottom: 12px; }
.invf-tour-title { font-size: 18px; font-weight: 800; color: #1A1A1A; margin-bottom: 8px; }
.invf-tour-desc { font-size: 14px; color: #5C5C5C; line-height: 1.5; margin-bottom: 20px; }
.invf-tour-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 20px; }
.invf-tour-dot { width: 6px; height: 6px; border-radius: 999px; background: #E3E3E3; }
.invf-tour-dot--active { background: #008060; width: 18px; }
.invf-tour-actions { display: flex; align-items: center; justify-content: center; gap: 10px; }
.invf-tour-prev {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 10px 18px;
  border-radius: 9px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-tour-prev:hover { background: #F7F7F7; }
.invf-tour-next {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 10px 22px;
  border-radius: 9px;
  background: #008060;
  color: #FFFFFF;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
}
.invf-tour-next:hover { background: #026B4F; }
`;

function tourSlides(t: Dictionary) {
  return [
    { icon: "👋", title: t.tourStep1Title, desc: t.tourStep1Desc },
    { icon: "🗂️", title: t.tourStep2Title, desc: t.tourStep2Desc },
    { icon: "📦", title: t.tourStep3Title, desc: t.tourStep3Desc },
    { icon: "⚙️", title: t.tourStep4Title, desc: t.tourStep4Desc },
  ];
}

export function WelcomeTour(props: { t: Dictionary }) {
  const { t } = props;
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const fetcher = useFetcher();

  if (dismissed) return null;

  const slides = tourSlides(t);
  const isLast = step === slides.length - 1;
  const current = slides[step];

  function close() {
    fetcher.submit(null, { method: "post", action: "/app/tour" });
    setDismissed(true);
  }

  return (
    <div className="invf-tour-overlay" role="dialog" aria-modal="true" aria-label={t.tourAriaLabel}>
      <style>{TOUR_CSS}</style>
      <div className="invf-tour-panel">
        <button type="button" className="invf-tour-skip" onClick={close}>
          {t.tourSkip}
        </button>
        <div className="invf-tour-icon" aria-hidden="true">{current.icon}</div>
        <div className="invf-tour-title">{current.title}</div>
        <div className="invf-tour-desc">{current.desc}</div>
        <div className="invf-tour-dots" aria-hidden="true">
          {slides.map((_, i) => (
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
      </div>
    </div>
  );
}
