import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { assignSupplierToVariant } from "../lib/suppliers.server";
import { getForecastGroups } from "../lib/forecastCache.server";

// Tedarikçi ataması leadTimeDays'i kopyaladığı için (bkz. suppliers.server.ts)
// computeForecast()'un girdisini değiştiriyor — app.leadTimeOverride.tsx'teki
// AYNI sebeple (bkz. oradaki not) forceRefresh şart, aksi halde değişiklik
// 15 dakikalık önbellek dolana kadar yansımaz.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const variantId = String(formData.get("variantId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!variantId) return { ok: false };

  await assignSupplierToVariant(session.shop, variantId, supplierId || null);
  await getForecastGroups(session.shop, admin, { forceRefresh: true });

  return { ok: true };
};
