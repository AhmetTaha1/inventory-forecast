import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { fetchSalesSnapshot, logSnapshot, snapshotToPlain } from "../lib/sales.server";
import { computeForecast } from "../lib/forecast";
import { boundary } from "@shopify/shopify-app-react-router/server";
// snapshot'ı diske yazmak için (Adım 3'ten beri duruyor)
import fs from "node:fs/promises";
import path from "node:path";

// YENİ (Adım 7): yeniden sipariş uyarısı eşiği. Mevcut turuncu/kırmızı rozet
// eşiğiyle aynı sayı — yeni bir eşik icat etmek yerine tutarlılık tercih edildi.
const REORDER_ALERT_DAYS = 14;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const t0 = Date.now();
  const snapshot = await fetchSalesSnapshot(admin);
  logSnapshot(snapshot, Date.now() - t0);

  // snapshot.json: motoru Shopify'a bağlanmadan test etmeyi sağlıyor (Adım 3).
  const snapshotPath = path.join(process.cwd(), "snapshot.json");
  await fs.writeFile(snapshotPath, JSON.stringify(snapshotToPlain(snapshot), null, 2));
  console.log(`[Adım 3] snapshot.json yazıldı: ${snapshotPath}`);

  const forecastResult = computeForecast(snapshot);

  // Draft ürünler tükenme ekranından gizleniyor (Adım 6, Bölüm 15 "A" kararı).
  const visible = forecastResult.forecasts.filter((f) => f.status !== "DRAFT");
  const hiddenDraftCount = forecastResult.forecasts.length - visible.length;

  const outOfStock = visible.filter((f) => f.method === "already_out_of_stock");

  const soonToStockout = visible
    .filter((f) => f.method === "weighted_average")
    .sort((a, b) => (a.stockoutInDays ?? Infinity) - (b.stockoutInDays ?? Infinity));

  // YENİ (Adım 7): "Tahmin yapılamayanlar" ikiye ayrıldı.
  // - insufficientData: veri yetersiz (çoğunlukla yeni ürün) — ölü stok DEĞİL.
  // - deadStock: geçmişte satmış, son dönemde satmayan, stoğu elde kalmış.
  const insufficientData = visible.filter((f) => f.method === "insufficient_data");
  const deadStock = visible.filter((f) => f.method === "no_recent_sales");

  // YENİ (Adım 7): yeniden sipariş uyarısı — zaten tükenmiş + REORDER_ALERT_DAYS
  // gün içinde tükenecekler. Ayrı bir liste değil, mevcut iki listenin bir
  // alt kümesi; banner'da öne çıkarmak için burada birleştiriliyor.
  const reorderAlerts = [
    ...outOfStock,
    ...soonToStockout.filter((f) => (f.stockoutInDays ?? Infinity) <= REORDER_ALERT_DAYS),
  ];

  console.log(
    `\n[Adım 7] Görünür: ${visible.length} (${hiddenDraftCount} draft gizlendi). ` +
      `Zaten tükenen: ${outOfStock.length}, yakında tükenecek: ${soonToStockout.length}, ` +
      `ölü stok adayı: ${deadStock.length}, veri yetersiz: ${insufficientData.length}, ` +
      `sipariş uyarısı: ${reorderAlerts.length}.`,
  );

  return { outOfStock, soonToStockout, insufficientData, deadStock, reorderAlerts };
};

export default function Index() {
  const { outOfStock, soonToStockout, insufficientData, deadStock, reorderAlerts } =
    useLoaderData<typeof loader>();

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
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};