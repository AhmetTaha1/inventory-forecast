import type { Dictionary } from "../lib/translations";
import { SpotlightTour, type TourStep } from "./SpotlightTour";

// Ana panel (dashboard) turu — SADECE ilk açılışta gösterilir, bir daha asla
// çıkmaz. Genel spot ışığı mekaniği artık SpotlightTour.tsx'te (bkz. orada:
// ürün detay ve sipariş ayarları sayfaları da kendi kısa turlarını aynı
// bileşenle kuruyor).
function buildSteps(t: Dictionary): TourStep[] {
  return [
    { selector: null, title: t.tourStep1Title, desc: t.tourStep1Desc },
    { selector: ".invf-summary", title: t.tourStep2Title, desc: t.tourStep2Desc },
    { selector: ".invf-list-card", title: t.tourStep3Title, desc: t.tourStep3Desc },
    { selector: ".invf-settings-link", title: t.tourStep4Title, desc: t.tourStep4Desc },
  ];
}

export function WelcomeTour(props: { t: Dictionary }) {
  return (
    <SpotlightTour
      t={props.t}
      steps={buildSteps(props.t)}
      ariaLabel={props.t.tourAriaLabel}
      postAction="/app/tour"
      showWelcomeIcon
    />
  );
}
