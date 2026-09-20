import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Shopify'ın App Store'a kabul ettiği HER uygulama için zorunlu 3 GDPR
// webhook'u (bkz. shopify.dev/changelog/apps-now-need-to-use-gdpr-webhooks).
// Bunlar müşteri/mağaza verisi tutmasak bile zorunlu — gelen isteğe 30 gün
// içinde 2xx dönmemiz gerekiyor, aksi halde App Store'dan çıkarılabiliriz.
//
// Bizim durumumuz basit: `ForecastSnapshot` tablosunda sadece mağaza
// bazlı, TOPLU (agregatif) stok/satış özetleri tutuyoruz — hiçbir müşteri
// adı/e-postası/siparişi kişi bazında saklanmıyor. Bu yüzden
// CUSTOMERS_DATA_REQUEST ve CUSTOMERS_REDACT için silinecek/verilecek bir
// şey yok, sadece onaylıyoruz. SHOP_REDACT'te ise mağazanın kendi
// snapshot'ını temizliyoruz (uninstall webhook'u zaten Session'ı siliyor,
// ama mağaza hâlâ kurulu değilken 48 saat sonra bu webhook de gelebilir).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Müşteri bazında hiçbir veri tutmuyoruz — verilecek bir şey yok.
      break;

    case "CUSTOMERS_REDACT":
      // Aynı sebeple silinecek müşteri bazlı veri yok.
      break;

    case "SHOP_REDACT": {
      const shopDomain = (payload as { shop_domain?: string })?.shop_domain ?? shop;
      await db.forecastSnapshot.deleteMany({ where: { shop: shopDomain } });
      await db.session.deleteMany({ where: { shop: shopDomain } });
      break;
    }

    default:
      console.warn(`Beklenmeyen compliance webhook konusu: ${topic}`);
  }

  return new Response();
};
