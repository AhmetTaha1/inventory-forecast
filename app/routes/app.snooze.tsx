import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { snoozeVariant, unsnoozeVariant } from "../lib/snooze.server";

// Sadece bir action — sayfa/loader yok. ProductRow'daki <fetcher.Form>
// buraya POST atıyor, react-router başarılı action sonrası ana sayfanın
// loader'ını otomatik olarak yeniden çalıştırıp panelin (özet kartları,
// filtreler, "X ürün ertelendi" bağlantısı) güncellenmesini sağlıyor.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const variantId = String(formData.get("variantId") ?? "");
  const choice = String(formData.get("action") ?? "");
  if (!variantId) return { ok: false };

  if (choice === "unsnooze") {
    await unsnoozeVariant(session.shop, variantId);
  } else if (choice === "indefinite") {
    await snoozeVariant(session.shop, variantId, null);
  } else {
    const days = Number(choice);
    if (Number.isFinite(days) && days > 0) {
      await snoozeVariant(session.shop, variantId, days);
    }
  }

  return { ok: true };
};
