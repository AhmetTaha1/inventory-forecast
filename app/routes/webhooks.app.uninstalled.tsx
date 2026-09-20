import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Mağazanın tahmin önbelleğini de hemen temizliyoruz — 48 saat sonra
  // gelecek shop/redact webhook'unu (bkz. webhooks.compliance.tsx) beklemeye
  // gerek yok, veri minimizasyonu için uninstall anında silmek daha doğru.
  await db.forecastSnapshot.deleteMany({ where: { shop } });

  return new Response();
};
