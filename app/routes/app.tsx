import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { resolvePlanTier } from "../lib/partnerBilling.server";
import { resolveLocale, getDictionary, type Locale } from "../lib/translations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));

  // Aboneliği olmayan mağaza artık plan seçim sayfasına YÖNLENDİRİLMİYOR.
  // Eskiden öyleydi: abonelik yoksa uygulamaya hiç girilemiyordu. Artık
  // ücretsiz katmana düşüyor (bkz. partnerBilling.server.ts:
  // resolvePlanTier) — sınırlı ama çalışan bir deneyim + panelde yükseltme
  // çağrısı. Sebep: bu kategoride kurulum hacmi ve ilk yorumlar ücretsiz
  // katmanla geliyor; ücretsiz katmanı olmayan en yakın benzerimiz 23
  // yorumda duraklamışken ücretsiz katmanı olanlar 250-360 yoruma ulaşmış.
  const { tier, trialDaysLeft, planUrl } = await resolvePlanTier(admin);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", locale, trialDaysLeft, planTier: tier, planUrl };
};

const TRIAL_URGENT_DAYS = 5;

function TrialBanner({ daysLeft, locale }: { daysLeft: number; locale: Locale }) {
  const t = getDictionary(locale);
  const urgent = daysLeft <= TRIAL_URGENT_DAYS;

  return (
    <div
      className={urgent ? "invf-trial invf-trial--urgent" : "invf-trial"}
      role="status"
    >
      <span aria-hidden="true">{urgent ? "⏳" : "✨"}</span>
      <span>
        <strong>{t.trialBannerDaysLeft(daysLeft)}</strong> {t.trialBannerNote}
      </span>
    </div>
  );
}

export default function App() {
  const { apiKey, locale, trialDaysLeft, planTier, planUrl } = useLoaderData<typeof loader>();
  const t = getDictionary(locale);
  const navigation = useNavigation();
  // Sayfalar arası geçişte (ör. panel → ayarlar) yeni sayfanın loader'ı
  // çalışırken önceden HİÇBİR görsel geri bildirim yoktu — kullanıcı
  // bembeyaz bir ekranla karşılaşıyordu, sanki uygulama donmuş gibi
  // görünüyordu. Üstte ince bir ilerleme çubuğu, "bir şeyler oluyor"
  // sinyalini veriyor.
  const isNavigating = navigation.state !== "idle";

  return (
    <AppProvider embedded apiKey={apiKey}>
      {isNavigating && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 200,
            background: "#008060",
            animation: "invf-nav-progress 1s ease-in-out infinite",
          }}
        />
      )}
      <style>{`
        @keyframes invf-nav-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* Bu bant, sayfaların kendi <s-page> kabının DIŞINDA (kök yerleşimde)
           render oluyor — o yüzden sayfa kabının dolgusuna güvenemez, kendi
           kenar boşluklarını taşıyor. */
        .invf-trial {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          margin: 12px 16px 0;
          padding: 11px 15px;
          border-radius: 10px;
          border: 1px solid #D7E8DF;
          background: #F1F8F5;
          font-size: 13.5px;
          line-height: 1.45;
          color: #1A1A1A;
        }
        .invf-trial--urgent {
          border-color: #E8D9B0;
          background: #FFF8E8;
        }
        .invf-trial strong { font-weight: 700; }
        /* Kalıcı plan linki — sessiz ve küçük. Ücretsiz katmanda hafifçe
           vurgulu (yeşil), ücretlide tamamen nötr bir "planı yönet" linki. */
        .invf-planlink {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          margin: 10px 16px 0;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid #D4D4D4;
          background: #FFFFFF;
          font-size: 12.5px;
          font-weight: 600;
          color: #5C5C5C;
          text-decoration: none;
        }
        .invf-planlink:hover { border-color: #008060; color: #1A1A1A; }
        .invf-planlink--upgrade {
          border-color: #008060;
          color: #0C5132;
          background: #F1F8F4;
          font-weight: 700;
        }
        .invf-planlink--upgrade:hover { background: #E3F1DF; }
      `}</style>
      {trialDaysLeft != null && <TrialBanner daysLeft={trialDaysLeft} locale={locale} />}
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/settings">Reorder settings</s-link>
        <s-link href="/app/suppliers">Suppliers</s-link>
      </s-app-nav>
      {/* Kalıcı plan girişi. Shopify App Store kuralı 1.2.3 ZORUNLU kılıyor:
          "Uygulamanız, satıcıların destek ekibinizle iletişime geçmeden veya
          uygulamayı yeniden kurmadan planlarını yükseltip DÜŞÜRMELERİNE izin
          vermelidir." Yani bu link sadece bir satış kancası değil, onaydan
          geçmek için gerekli — ve ücretli kullanıcının da plan değiştirmesi
          için tek yolu.

          Bilerek sessiz: kesintiye uğratan tam ekran bir tanıtım YOK.
          Araştırma, bağlamsal uyarıların (özelliğin kilitli olduğu yerde
          gösterilen kart) genel/kesintili uyarılara göre 3-5 kat daha iyi
          dönüştüğünü, erken paywall'ın ise güveni düşürüp silmeyi artırdığını
          gösteriyor. Üstelik ilk açılışta zaten karşılama turu var. */}
      {planUrl && (
        <a
          href={planUrl}
          target="_top"
          className={planTier === "free" ? "invf-planlink invf-planlink--upgrade" : "invf-planlink"}
        >
          {planTier === "free" ? t.navUpgrade : t.navManagePlan}
        </a>
      )}
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
