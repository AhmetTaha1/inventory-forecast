import type { Dictionary } from "../lib/translations";
import { SpotlightTour, type TourStep } from "./SpotlightTour";

// Ürün detay sayfasının kendi turu — SADECE bu sayfaya ilk kez girildiğinde
// gösterilir (bkz. shopSettings.server.ts: hasDetailsTourBeenSeen). Hedef
// selector'lar app.product.$variantId.tsx'teki bölüm sarmalayıcılarına
// (#invf-pdp-health vb.) işaret ediyor.
function buildSteps(t: Dictionary): TourStep[] {
  return [
    { selector: "#invf-pdp-health", title: t.detailsTourStep1Title, desc: t.detailsTourStep1Desc },
    { selector: "#invf-pdp-charts", title: t.detailsTourStep2Title, desc: t.detailsTourStep2Desc },
    { selector: "#invf-pdp-supplier", title: t.detailsTourStep3Title, desc: t.detailsTourStep3Desc },
    { selector: "#invf-pdp-math", title: t.detailsTourStep4Title, desc: t.detailsTourStep4Desc },
  ];
}

export function DetailsPageTour(props: { t: Dictionary }) {
  return (
    <SpotlightTour
      t={props.t}
      steps={buildSteps(props.t)}
      ariaLabel={props.t.detailsTourAriaLabel}
      postAction="/app/tour"
      postExtra={{ page: "details" }}
    />
  );
}
