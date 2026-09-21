import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { markTourSeen } from "../lib/shopSettings.server";

// Sadece bir action — sayfa/loader yok. WelcomeTour.tsx buraya POST atıp
// turu kalıcı olarak "görüldü" işaretliyor (bkz. app.snooze.tsx ile aynı
// desen: aksiyon-sadece rota, useFetcher ile çağrılıyor).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await markTourSeen(session.shop);
  return { ok: true };
};
