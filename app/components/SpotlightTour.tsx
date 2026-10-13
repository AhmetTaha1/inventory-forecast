import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { useFetcher } from "react-router";
import type { Dictionary } from "../lib/translations";
import { INVF_FONT_STACK } from "../lib/fontStack";

// ---------------------------------------------------------------------------
// Genel amaçlı "spot ışığı" turu — WelcomeTour.tsx'in (sadece panel/dashboard
// içindi) ÇIKARILMIŞ, sayfa-bağımsız hali. Yeni sayfalar (ürün detayı,
// sipariş ayarları) çok sayıda yeni bölüm kazandıkça ("her biri kendi
// başına anlaşılması zor" — kullanıcı geri bildirimi), her sayfa için AYRI,
// SADECE İLK ZİYARETTE gösterilen kendi kısa turu olsun diye bu bileşen
// tek bir yerde tutuluyor; her sayfa sadece kendi `steps` dizisini ve hangi
// "görüldü" alanını işaretleyeceğini (`postExtra`) veriyor.
// ---------------------------------------------------------------------------

export type TourStep = {
  selector: string | null; // null = ortada (sadece bir sayfanın İLK adımı için mantıklı)
  title: string;
  desc: string;
};

const SPOTLIGHT_PADDING = 10;
// Kullanıcı geri bildirimi: tur balonundaki yazılar sayfanın geri kalanına
// (başlıklar, grafik metinleri vb. — hepsi bu proje boyunca büyütüldü) göre
// küçük/okunması zor kalmıştı. Genişlik de büyütülen yazıya göre arttı.
const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 16;
// Balonun kabaca yüksekliği (başlık+açıklama+noktalar+butonlar) — kesin
// piksel değil, "üstte/altta yeterli yer var mı" kararını vermek için kaba
// bir tahmin yeterli.
const TOOLTIP_HEIGHT_ESTIMATE = 230;
const SCREEN_EDGE_MARGIN = 16;

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
  /* Kullanıcı geri bildirimi: telefonda balon ekranın sağına-soluna neredeyse
     hiç boşluk bırakmadan tam kaplıyordu ("rezalet"). Sabit genişlik artık
     dar ekranlarda görünüm alanına göre küçülüyor, iki yanda her zaman
     eşit bir boşluk kalıyor. */
  max-width: calc(100vw - ${SCREEN_EDGE_MARGIN * 2}px);
  max-height: calc(100vh - ${SCREEN_EDGE_MARGIN * 2}px);
  overflow-y: auto;
  background: #FFFFFF;
  border-radius: 14px;
  padding: 20px 20px 16px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.35);
  z-index: 301;
  transition: top 250ms ease, left 250ms ease;
  font-family: ${INVF_FONT_STACK};
  box-sizing: border-box;
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
  top: 8px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #6B6B6B;
  padding: 10px 12px;
  border-radius: 6px;
}
.invf-tour-skip:hover { background: #F1F1F1; color: #1A1A1A; }
.invf-tour-icon { font-size: 32px; margin-bottom: 10px; }
.invf-tour-title { font-size: 19px; font-weight: 800; color: #1A1A1A; margin-bottom: 8px; padding-right: 40px; }
.invf-tour-tooltip--centered .invf-tour-title { padding-right: 0; font-size: 21px; }
.invf-tour-desc { font-size: 15px; color: #4A4A4A; line-height: 1.55; margin-bottom: 18px; }
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
  font-size: 14px;
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
  font-size: 14px;
  font-weight: 700;
}
.invf-tour-next:hover { background: #026B4F; }
`;

export function SpotlightTour(props: {
  t: Dictionary;
  steps: TourStep[];
  ariaLabel: string;
  postAction: string;
  postExtra?: Record<string, string>;
  showWelcomeIcon?: boolean; // ilk adım ortadaysa 👋 göster (sadece ana panel turunda)
}) {
  const { t, steps, ariaLabel, postAction, postExtra, showWelcomeIcon } = props;
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const fetcher = useFetcher();

  const current = steps[step];

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
    // Bazı adımlar (ör. detay sayfasındaki grafik/hesap bölümleri) birden
    // fazla bileşeni saran uzun bir sarmalayıcıyı hedefliyor — telefon
    // ekranından çok daha uzun. Böyle bir hedefi ekranın ORTASINA almaya
    // çalışmak üstünü/altını ekran dışına taşırıp balonu içeriğin üstüne
    // bindiriyordu ("kare içindekini okuyamıyorum" — kullanıcı geri
    // bildirimi). Uzun hedeflerde ekranın EN ÜSTÜNE hizalıyoruz ki en
    // azından başlangıcı balonun üstünde, açık şekilde görünsün.
    const rawHeight = el.getBoundingClientRect().height;
    const isTallTarget = rawHeight > window.innerHeight * 0.55;
    el.scrollIntoView({ behavior: "smooth", block: isTallTarget ? "start" : "center" });

    function measure() {
      const r = el!.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
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
    fetcher.submit(postExtra ?? null, { method: "post", action: postAction });
    setDismissed(true);
  }

  let tooltipStyle: CSSProperties = {};
  // Hedef, balonun üstüne ya da altına sığmayacak kadar uzunsa (ör. birden
  // fazla grafiği saran bölüm), kutuyu balonun bittiği yere kadar kısaltıp
  // balonu ekranın en altına sabitliyoruz — böylece ikisi asla üst üste
  // binmiyor, kullanıcı hem vurgulanan alanın başını hem açıklama kartını
  // aynı anda okuyabiliyor.
  let clampedSpotlightHeight: number | null = null;
  if (rect) {
    const left = Math.min(
      Math.max(SCREEN_EDGE_MARGIN, rect.left),
      window.innerWidth - TOOLTIP_WIDTH - SCREEN_EDGE_MARGIN,
    );
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    if (spaceBelow >= TOOLTIP_HEIGHT_ESTIMATE + TOOLTIP_GAP) {
      tooltipStyle = { top: rect.top + rect.height + TOOLTIP_GAP, left };
    } else if (spaceAbove >= TOOLTIP_HEIGHT_ESTIMATE + TOOLTIP_GAP) {
      tooltipStyle = { top: Math.max(SCREEN_EDGE_MARGIN, rect.top - TOOLTIP_GAP - TOOLTIP_HEIGHT_ESTIMATE), left };
    } else {
      tooltipStyle = { top: "auto", bottom: SCREEN_EDGE_MARGIN, left };
      clampedSpotlightHeight = Math.max(
        60,
        window.innerHeight - rect.top - TOOLTIP_HEIGHT_ESTIMATE - TOOLTIP_GAP * 2,
      );
    }
  }

  const body = (
    <>
      <button type="button" className="invf-tour-skip" onClick={close}>
        {t.tourSkip}
      </button>
      {!current.selector && showWelcomeIcon && <div className="invf-tour-icon" aria-hidden="true">👋</div>}
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
    <div role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <style>{TOUR_CSS}</style>
      <div className="invf-tour-backdrop" onClick={close} />
      {rect && (
        <div
          className="invf-tour-spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: (clampedSpotlightHeight ?? rect.height) + SPOTLIGHT_PADDING * 2,
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
