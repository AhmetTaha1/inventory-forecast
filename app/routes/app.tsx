import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
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
      `}</style>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/settings">Reorder settings</s-link>
      </s-app-nav>
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
