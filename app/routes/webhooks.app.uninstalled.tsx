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

  // Günlük e-posta özeti tercihi de siliniyor. Önceden kalıyordu ve iki
  // ayrı soruna yol açıyordu:
  // 1) Zamanlayıcı (bkz. digestScheduler.server.ts) bu mağazayı her gün
  //    "gönderilecekler" listesine alıyor, oturum olmadığı için gönderim
  //    patlıyor, bu yüzden "bugün gönderildi" işareti hiç konmuyor ve
  //    mağaza SONSUZA KADAR her turda yeniden deneniyordu — kaldıran her
  //    mağaza için kalıcı, birikimli bir yük.
  // 2) Uygulama sonradan yeniden kurulursa, yeni kuran kişinin hiç
  //    onaylamadığı ESKİ bir adrese (ör. işten ayrılmış bir çalışan)
  //    e-posta göndermeye kendiliğinden devam ediyordu.
  await db.digestPreference.deleteMany({ where: { shop } });

  return new Response();
};
