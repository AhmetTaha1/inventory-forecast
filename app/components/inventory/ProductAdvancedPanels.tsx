import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import type { Dictionary, Locale } from "../../lib/translations";
import { computeWindowEstimates, simulateGrowth, type ReorderSettings } from "../../lib/forecast";
import { rateText, stockoutDateText } from "../../lib/inventory/format";
import type { Supplier } from "../../lib/suppliers.server";

// ---------------------------------------------------------------------------
// Rakip araştırmasından esinlenilen üç ek panel — hepsi ürün detay
// sayfasında (bkz. app.product.$variantId.tsx):
//   1. TransparencyPanel — "kara kutu değil" felsefesi, sipariş miktarı
//      hesabının HER adımı açık (Stockcast-tarzı rakipten).
//   2. WindowEstimatesTable — tek bir sayıya güvenmek yerine 14/30/60/90
//      günlük pencerelere göre karşılaştırma (Sensible-tarzı rakipten).
//   3. SimulateGrowthCard — büyüme/düşüş senaryosu, TAMAMEN istemci
//      tarafında (sunucuya hiç gitmiyor, forecast.ts'teki saf
//      simulateGrowth() fonksiyonu her tuş vuruşunda çağrılıyor).
//   4. SupplierAssignment — tedarikçi preset'i atama (bkz. suppliers.server.ts).
// ---------------------------------------------------------------------------

const UNITS_SOLD_WINDOW_DAYS = 90;

function daysSince(dayStr: string, now: Date): number {
  const d = new Date(dayStr + "T00:00:00Z");
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

export function TransparencyPanel(props: {
  available: number;
  dailyRate: number | null;
  salesByDay: Record<string, number> | null;
  leadTimeDays: number;
  coverageDays: number;
  suggestedReorderQty: number | null;
  t: Dictionary;
}) {
  const { available, dailyRate, salesByDay, leadTimeDays, coverageDays, suggestedReorderQty, t } = props;

  if (dailyRate == null) {
    return (
      <div className="invf-pd-chart-card">
        <div className="invf-pd-chart-title">{t.transparencyPanelTitle}</div>
        <div className="invf-pd-chart-subtitle">{t.transparencyPanelSubtitle}</div>
        <div className="invf-pd-empty">{t.transparencyUnavailable}</div>
      </div>
    );
  }

  const now = new Date();
  const unitsSold = salesByDay
    ? Object.entries(salesByDay).reduce((sum, [day, qty]) => (daysSince(day, now) < UNITS_SOLD_WINDOW_DAYS ? sum + qty : sum), 0)
    : 0;
  const closingStock = Math.round(available - dailyRate * (leadTimeDays + coverageDays));

  const rows: [string, string][] = [
    [t.transparencyLeadTime, `${leadTimeDays} ${t.inlineLeadTimeSuffix}`],
    [t.transparencyCoverageDays, `${coverageDays} ${t.inlineLeadTimeSuffix}`],
    [t.transparencyDailyAvgSales, dailyRate.toFixed(1)],
    [t.transparencyUnitsSold(UNITS_SOLD_WINDOW_DAYS), String(unitsSold)],
    [t.transparencyCurrentStock, String(available)],
  ];

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.transparencyPanelTitle}</div>
      <div className="invf-pd-chart-subtitle">{t.transparencyPanelSubtitle}</div>
      <div>
        {rows.map(([label, value]) => (
          <div className="invf-pd-location-row" key={label}>
            <span style={{ color: "#5C5C5C" }}>{label}</span>
            <span style={{ fontWeight: 700, color: "#1A1A1A" }}>{value}</span>
          </div>
        ))}
        <div className="invf-pd-location-row">
          <span style={{ color: "#5C5C5C" }} title={t.transparencyClosingStockHelp}>
            {t.transparencyClosingStock}
          </span>
          <span style={{ fontWeight: 700, color: closingStock < 0 ? "#C4210B" : "#1A1A1A" }}>{closingStock}</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          paddingTop: 12,
          borderTop: "1px solid #E3E3E3",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{t.transparencyResultLabel}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#008060" }}>{suggestedReorderQty ?? 0}</span>
      </div>
    </div>
  );
}

export function WindowEstimatesTable(props: {
  salesByDay: Record<string, number> | null;
  available: number;
  settings: ReorderSettings;
  locale: Locale;
  t: Dictionary;
}) {
  const { salesByDay, available, settings, t } = props;
  const estimates = computeWindowEstimates(salesByDay, new Date(), available, settings);

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.windowEstimatesTitle}</div>
      <div className="invf-pd-chart-subtitle">{t.windowEstimatesSubtitle}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase" }}>{t.windowEstimatesRateColumn}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase" }}>{t.windowEstimatesQtyColumn}</span>
        {estimates.map((e) => (
          <Fragment key={e.windowDays}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1A1A" }}>
              {t.windowEstimatesWindowLabel(e.windowDays)}
            </span>
            <span style={{ fontSize: 13.5, color: "#1A1A1A" }}>
              {e.dailyRate == null ? t.windowEstimatesNoData : rateText(e.dailyRate, t)}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1A1A1A" }}>
              {e.suggestedReorderQty == null ? "—" : e.suggestedReorderQty}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function SimulateGrowthCard(props: {
  dailyRate: number | null;
  available: number;
  settings: ReorderSettings;
  locale: Locale;
  t: Dictionary;
}) {
  const { dailyRate, available, settings, locale, t } = props;
  const [growth, setGrowth] = useState(0);

  if (dailyRate == null || dailyRate <= 0) {
    return (
      <div className="invf-pd-chart-card">
        <div className="invf-pd-chart-title">{t.simulateTitle}</div>
        <div className="invf-pd-chart-subtitle">{t.simulateSubtitle}</div>
        <div className="invf-pd-empty">{t.simulateUnavailable}</div>
      </div>
    );
  }

  const result = simulateGrowth(dailyRate, available, growth, settings);

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.simulateTitle}</div>
      <div className="invf-pd-chart-subtitle">{t.simulateSubtitle}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#4A4A4A" }} htmlFor="invf-sim-growth">
          {t.simulateGrowthLabel}
        </label>
        <input
          id="invf-sim-growth"
          type="range"
          min={-75}
          max={200}
          step={5}
          value={growth}
          onChange={(e) => setGrowth(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#008060" }}
        />
        <span style={{ fontSize: 14, fontWeight: 800, color: growth >= 0 ? "#0C5132" : "#C4210B", minWidth: 44, textAlign: "right" }}>
          {growth > 0 ? "+" : ""}
          {growth}%
        </span>
      </div>
      <div style={{ fontSize: 14, color: "#1A1A1A", marginBottom: 6 }}>
        {result.stockoutInDays != null
          ? t.simulateResultStockout(stockoutDateText(Math.max(result.stockoutInDays, 0), locale))
          : t.windowEstimatesNoData}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#008060", marginBottom: 16 }}>
        {t.simulateResultQty(result.suggestedReorderQty ?? 0)}
      </div>
    </div>
  );
}

export function SupplierAssignment(props: {
  variantId: string;
  suppliers: Supplier[];
  currentSupplierId: string | null;
  hasCustomOverrideNoSupplier: boolean;
  t: Dictionary;
}) {
  const { variantId, suppliers, currentSupplierId, hasCustomOverrideNoSupplier, t } = props;
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  // Tedarikçi seçimi sunucuda tahmini YENİDEN hesaplatıyor (bkz.
  // app.assignSupplier.tsx: forceRefresh) — bu birkaç saniye sürebiliyor ve
  // önceden o sürede ekranda hiçbir şey olmuyordu, kullanıcı seçimin
  // alındığından emin olamıyordu. Dönen gösterge + bitince kısa onay.
  const [justSaved, setJustSaved] = useState(false);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && (fetcher.data as { ok?: boolean } | undefined)?.ok) {
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 1800);
      return () => clearTimeout(timer);
    }
    wasBusy.current = busy;
  }, [busy, fetcher.data]);

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.supplierAssignLabel}</div>
      <div style={{ marginTop: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <fetcher.Form method="post" action="/app/assignSupplier">
          <input type="hidden" name="variantId" value={variantId} />
          <select
            name="supplierId"
            defaultValue={currentSupplierId ?? ""}
            disabled={busy}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            // maxWidth şart: <select> kendini EN UZUN seçeneğine göre
            // genişletir, uzun bir tedarikçi adı dar ekranda sayfaya yatay
            // kaydırma çubuğu ekliyordu.
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D4D4D4", font: "inherit", fontSize: 13.5, minWidth: 220, maxWidth: "100%" }}
          >
            <option value="">{t.supplierAssignNone}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.leadTimeDays} {t.inlineLeadTimeSuffix})
              </option>
            ))}
          </select>
        </fetcher.Form>
        {busy && (
          <span className="invf-pd-saving" role="status">
            <span className="invf-pd-spinner" aria-hidden="true" />
            {t.supplierAssignSaving}
          </span>
        )}
        {!busy && justSaved && <span className="invf-pd-saved">✓ {t.inlineLeadTimeSaved}</span>}
        <Link to="/app/suppliers" className="invf-pdp-btn invf-pdp-btn--ghost">
          {t.supplierManageLink}
        </Link>
      </div>
      {hasCustomOverrideNoSupplier && !currentSupplierId && (
        <div className="invf-pd-chart-subtitle" style={{ marginBottom: 0 }}>
          {t.supplierAssignCustomNote}
        </div>
      )}
    </div>
  );
}
