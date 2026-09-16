import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const { groups, computedAt, fromCache } = await getForecastGroups(session.shop, admin, {
    forceRefresh,
  });

  return { ...groups, computedAt: computedAt.toISOString(), fromCache };
};

export default function Index() {
  const {
    outOfStock,
    soonToStockout,
    insufficientData,
    deadStock,
    reorderAlerts,
    computedAt,
    fromCache,
  } = useLoaderData<typeof loader>();

  const hasUrgent = outOfStock.length > 0 || soonToStockout.length > 0;

  return (
    <s-page heading="Envanter Tahmini">
      {reorderAlerts.length > 0 && (
        <s-banner
          heading={`${reorderAlerts.length} ürün acilen yeniden sipariş edilmeli`}
          tone={outOfStock.length > 0 ? "critical" : "warning"}
        >
          {reorderAlerts
            .slice(0, 3)
            .map((f) => f.productTitle)
            .join(", ")}
          {reorderAlerts.length > 3 ? ` ve ${reorderAlerts.length - 3} ürün daha.` : "."}
        </s-banner>
      )}

      {!hasUrgent && (
        <s-section>
          <s-paragraph>
            Şu an tükenmiş ya da yakında tükenecek görünen bir ürün yok.
          </s-paragraph>
        </s-section>
      )}

      {outOfStock.length > 0 && (
        <s-section heading={`Zaten tükenenler (${outOfStock.length})`}>
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Ürün</s-table-header>
              <s-table-header>Varyant</s-table-header>
              <s-table-header>Durum</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {outOfStock.map((f) => (
                <s-table-row key={f.variantId}>
                  <s-table-cell>{f.productTitle}</s-table-cell>
                  <s-table-cell>{f.variantTitle}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone="critical">Tükendi</s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {soonToStockout.length > 0 && (
        <s-section heading={`Yakında tükenecekler (${soonToStockout.length})`}>
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Ürün</s-table-header>
              <s-table-header>Varyant</s-table-header>
              <s-table-header>Stok</s-table-header>
              <s-table-header>Günlük satış</s-table-header>
              <s-table-header>Tükenmeye kalan</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {soonToStockout.map((f) => {
                const days = Math.round(f.stockoutInDays ?? 0);
                const tone = days <= 7 ? "critical" : days <= 21 ? "warning" : "info";
                return (
                  <s-table-row key={f.variantId}>
                    <s-table-cell>{f.productTitle}</s-table-cell>
                    <s-table-cell>{f.variantTitle}</s-table-cell>
                    <s-table-cell>{f.available}</s-table-cell>
                    <s-table-cell>{f.dailyRate?.toFixed(2) ?? "-"}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={tone}>{`${days} gün`}</s-badge>
                      {f.confidence === "low" && <s-text> (düşük güven)</s-text>}
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {deadStock.length > 0 && (
        <s-section heading={`Ölü stok adayları (${deadStock.length})`}>
          <s-paragraph>
            Geçmişte satmış ama son dönemde hiç satışı olmayan, stoğu elde
            kalmış ürünler.
          </s-paragraph>
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Ürün</s-table-header>
              <s-table-header>Varyant</s-table-header>
              <s-table-header>Stok</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {deadStock.map((f) => (
                <s-table-row key={f.variantId}>
                  <s-table-cell>{f.productTitle}</s-table-cell>
                  <s-table-cell>{f.variantTitle}</s-table-cell>
                  <s-table-cell>{f.available}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {insufficientData.length > 0 && (
        <s-section heading={`Tahmin yapılamayanlar (${insufficientData.length})`}>
          <s-paragraph>
            Yeterli satış verisi olmayan ürünler — çoğunlukla yeni eklenmiş.
          </s-paragraph>
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Ürün</s-table-header>
              <s-table-header>Varyant</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {insufficientData.map((f) => (
                <s-table-row key={f.variantId}>
                  <s-table-cell>{f.productTitle}</s-table-cell>
                  <s-table-cell>{f.variantTitle}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-section>
        <s-paragraph>
          Son hesaplama: {new Date(computedAt).toLocaleTimeString("tr-TR")}
          {fromCache ? " (önbellekten)" : " (az önce yeniden hesaplandı)"} —{" "}
          <Link to="?refresh=1">şimdi yenile</Link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};