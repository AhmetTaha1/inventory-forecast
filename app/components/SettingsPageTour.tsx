import type { Dictionary } from "../lib/translations";
import { SpotlightTour, type TourStep } from "./SpotlightTour";

// Sipariş ayarları sayfasının kendi turu — SADECE bu sayfaya ilk kez
// girildiğinde gösterilir (bkz. shopSettings.server.ts:
// hasSettingsTourBeenSeen). Hedef selector'lar app.settings.tsx'teki iki
// karta (#invf-settings-reorder-card, #invf-settings-digest-card) işaret ediyor.
function buildSteps(t: Dictionary): TourStep[] {
  return [
    { selector: "#invf-settings-reorder-card", title: t.settingsTourStep1Title, desc: t.settingsTourStep1Desc },
    { selector: "#invf-settings-digest-card", title: t.settingsTourStep2Title, desc: t.settingsTourStep2Desc },
  ];
}

export function SettingsPageTour(props: { t: Dictionary }) {
  return (
    <SpotlightTour
      t={props.t}
      steps={buildSteps(props.t)}
      ariaLabel={props.t.settingsTourAriaLabel}
      postAction="/app/tour"
      postExtra={{ page: "settings" }}
    />
  );
}
