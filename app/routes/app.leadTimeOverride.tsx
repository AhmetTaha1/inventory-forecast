import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { setVariantLeadTimeOverride } from "../lib/variantOverrides.server";
import { getForecastGroups } from "../lib/forecastCache.server";

// Snooze'un aksine (bkz. app.snooze.tsx: bilerek cache DIŞINDA tutulur),
// tedarik süresi override'ı computeForecast()'un GİRDİSİ — reorderByDays,
// suggestedReorderQty, healthScore hep buna göre hesaplanıyor. Kaydettikten
// sonra ForecastSnapshot'ı zorla yenilemezsek, mağaza sahibi değişikliği
// TTL süresi (15 dk) dolana kadar görmezdi — bu satır içi/anlık bir
// düzenleme özelliği için kabul edilemez bir gecikme. Maliyeti "Yenile"
// butonuyla zaten aynı: tam bir Shopify resync.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const variantId = String(formData.get("variantId") ?? "");
  const raw = String(formData.get("leadTimeDays") ?? "");
  if (!variantId) return { ok: false };

  const leadTimeDays = raw === "" ? null : Number(raw);
  if (leadTimeDays != null && !Number.isFinite(leadTimeDays)) return { ok: false };

  await setVariantLeadTimeOverride(session.shop, variantId, leadTimeDays);
  await getForecastGroups(session.shop, admin, { forceRefresh: true });

  return { ok: true };
};
