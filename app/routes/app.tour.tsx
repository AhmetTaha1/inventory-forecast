import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { markTourSeen, markDetailsTourSeen, markSettingsTourSeen } from "../lib/shopSettings.server";

// Sadece bir action — sayfa/loader yok. SpotlightTour.tsx buraya POST atıp
// ilgili turu kalıcı olarak "görüldü" işaretliyor (bkz. app.snooze.tsx ile
// aynı desen: aksiyon-sadece rota, useFetcher ile çağrılıyor).
// "page" alanı hangi turun kapandığını ayırt ediyor — hiç gönderilmezse
// (WelcomeTour.tsx, ana panel) geriye dönük uyumluluk için "dashboard"
// sayılıyor.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const page = String(formData.get("page") ?? "dashboard");

  if (page === "details") {
    await markDetailsTourSeen(session.shop);
  } else if (page === "settings") {
    await markSettingsTourSeen(session.shop);
  } else {
    await markTourSeen(session.shop);
  }

  return { ok: true };
};
