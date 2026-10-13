import { useMemo, useState, type PointerEvent } from "react";
import type { Dictionary, Locale } from "../../lib/translations";
import type { HealthLabel } from "../../lib/forecast";
import { shortDateText, stockoutDateText } from "../../lib/inventory/format";

// ---------------------------------------------------------------------------
// Ürün detay sayfasının grafik/meter/lokasyon bileşenleri (bkz.
// app/routes/app.product.$variantId.tsx). Önceden bir modalın içindeydi —
// kullanıcı geri bildirimi üzerine (satır içi "Grafiği görüntüle" butonu
// hem yer sıkıntısı yaratıyordu hem de ileride sipariş/erteleme gibi başka
// özellikler eklemeye elverişli değildi) tam sayfa bir "Ürün detayı"
// görünümüne taşındı. Bileşenlerin kendisi DEĞİŞMEDİ, sadece host'u değişti.
//
// İki grafik — ikisi de dataviz skill'in "önce formu seç" kuralına göre
// seçildi:
//   1. Satış geçmişi -> haftalık toplam SÜREKLI değil KESIKLI bir büyüklük,
//      bu yüzden çubuk grafik (bar), tek seri, tek vurgu rengi (marka yeşili).
//   2. Stok tükenme projeksiyonu -> matematiksel bir projeksiyon eğrisi
//      (sürekli), bu yüzden çizgi grafik; tükenme noktası ayrı, rezerve
//      "critical" rengiyle (kırmızı) işaretleniyor.
// Geçmiş stok seviyesini hiç saklamıyoruz (sadece güncel adet) — bu yüzden
// "geçmiş stok" grafiği YOK, sadece satış geçmişi + ileriye projeksiyon var.

const ACCENT = "#008060";
const CRITICAL = "#C4210B";
const AXIS_GRAY = "#E3E3E3";
const TICK_TEXT = "#6B6B6B";

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / magnitude;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return niceNorm * magnitude;
}

export const PRODUCT_CHARTS_CSS = `
/* Kullanıcı geri bildirimi: mobilde detay sayfasındaki bölümler (sağlık,
   grafikler, tedarikçi, hesaplama) birbirinden ayrılıyor gibi görünmüyordu
   — açık gri (#E3E3E3) kenarlık küçük ekranda neredeyse görünmez kalıyordu.
   Kenarlık koyulaştı + hafif bir gölge eklendi ki her kart net bir "kutu"
   gibi ayrışsın; kartlar arası boşluk da artırıldı. */
.invf-pd-chart-card {
  border: 1px solid #D4D4D4;
  border-radius: 12px;
  padding: 16px 16px 8px;
  margin-top: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  background: #FFFFFF;
}
.invf-pd-chart-title { font-size: 17px; font-weight: 700; color: #1A1A1A; }
.invf-pd-chart-subtitle { font-size: 14px; color: #6B6B6B; margin-top: 3px; margin-bottom: 12px; }
.invf-pd-empty {
  font-size: 15px;
  color: #6B6B6B;
  padding: 24px 4px 20px;
  text-align: center;
}
.invf-pd-meter-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #EDEDED;
  overflow: hidden;
}
.invf-pd-meter-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 200ms ease;
}
/* gap + min-width/flex-shrink olmadan, uzun bir etiket ("Kapanış stoğu
   (sipariş verilmezse)") ya da uzun bir depo adı dar ekranda sarınca
   sağdaki sayıya sıfır boşlukla yapışıyordu. */
.invf-pd-location-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #F1F1F1;
  font-size: 14px;
}
.invf-pd-location-row > :first-child { min-width: 0; overflow-wrap: anywhere; }
.invf-pd-location-row > :last-child { flex-shrink: 0; }
.invf-pd-location-row:last-child { border-bottom: none; }

/* Kaydediliyor göstergesi (tedarikçi ataması gibi sunucuda tahmini yeniden
   hesaplatan işlemler birkaç saniye sürüyor). */
@keyframes invf-pd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.invf-pd-saving {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #4A4A4A;
}
.invf-pd-spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid #D4D4D4;
  border-top-color: #008060;
  animation: invf-pd-spin 0.7s linear infinite;
}
.invf-pd-saved { font-size: 13px; font-weight: 700; color: #0C5132; }

/* --- Grafiklerin mobil okunabilirliği ---------------------------------
   Grafikler sabit bir viewBox (620x230) ile çiziliyor ve genişliğe göre
   ÖLÇEKLENİYOR. 375px'lik bir telefonda kart içi genişlik ~311px, yani
   ölçek ~0.50: içerideki HER ŞEY yarıya iniyordu — 13.5px'lik eksen
   yazıları ekranda ~6.8px olarak çıkıyor, yani okunamıyordu (kullanıcı
   geri bildirimi: "mobilde bazı yazılar görünmüyor").
   İki düzeltme:
   1) height:auto — sabit 230px yükseklik, ölçeklenmiş çizimin altında
      kocaman boş bir bant bırakıyordu; artık kutu çizime göre kısalıyor.
   2) Dar ekranda eksen yazısı viewBox biriminde büyütülüyor; ölçek
      küçüldüğü için ekranda yine ~12px olarak görünüyor.
   CSS, SVG'nin fontSize ÖZNİTELİĞİNİ ezer — bu yüzden bileşen kodunu
   değiştirmeye gerek yok. Sadece eksen yazıları hedefleniyor: ipucu
   balonunun metni sabit genişlikli bir kutunun içinde, büyütülse taşardı
   (ayrıca dokunmatik ekranda hover ipucu zaten çıkmıyor). */
.invf-pd-chart-card svg { height: auto; display: block; }
@media (max-width: 560px) {
  .invf-pd-chart-card svg .invf-pd-axis { font-size: 22px; }
}
@media (max-width: 400px) {
  .invf-pd-chart-card svg .invf-pd-axis { font-size: 26px; }
}
`;

// ---------------------------------------------------------------------------
// Sağlık skoru: tek bir oranın bir sınıra göre nerede durduğunu gösteriyor
// -> dataviz skill'in "choosing-a-form" tablosundaki tam karşılığı "Meter"
// (bir pie/gauge değil). Dolgu rengi 4 sabit "status" tonundan biri
// (kategorik değil), her zaman ikon+etiketle birlikte.
// ---------------------------------------------------------------------------
const HEALTH_COLORS: Record<HealthLabel, { fg: string; bg: string }> = {
  healthy: { fg: "#0C5132", bg: "#E3F1DF" },
  watch: { fg: "#8A5A00", bg: "#FFF4E0" },
  at_risk: { fg: "#B7440D", bg: "#FFE4D1" },
  critical: { fg: "#C4210B", bg: "#FEE9E8" },
};

export function HealthMeter(props: { score: number; label: HealthLabel; t: Dictionary }) {
  const { score, label, t } = props;
  const { fg, bg } = HEALTH_COLORS[label];
  const labelText = {
    healthy: t.healthLabelHealthy,
    watch: t.healthLabelWatch,
    at_risk: t.healthLabelAtRisk,
    critical: t.healthLabelCritical,
  }[label];

  return (
    <div className="invf-pd-chart-card">
      {/* gap + min-width:0 + flexShrink:0 olmadan, dar ekranda uzun alt
          başlık 3-4 satıra sarıp sağdaki rozetle çakışıyordu. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="invf-pd-chart-title">{t.healthMeterTitle}</div>
          <div className="invf-pd-chart-subtitle" style={{ marginBottom: 8 }}>{t.healthMeterSubtitle}</div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            gap: 6,
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            color: fg,
            background: bg,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: fg, display: "inline-block" }} />
          {labelText} · {score}
        </span>
      </div>
      <div className="invf-pd-meter-track" style={{ marginBottom: 16 }}>
        <div className="invf-pd-meter-fill" style={{ width: `${score}%`, background: fg }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Çoklu lokasyon dağılımı: tek lokasyonlu mağazalarda (çoğunluk) hiçbir
// şey göstermiyor.
// ---------------------------------------------------------------------------
export function LocationBreakdown(props: { byLocation: Record<string, number>; levelsTruncated: boolean; t: Dictionary }) {
  const { byLocation, levelsTruncated, t } = props;
  const entries = Object.entries(byLocation).sort((a, b) => b[1] - a[1]);
  if (entries.length <= 1) return null;

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.locationBreakdownTitle}</div>
      <div style={{ marginTop: 10 }}>
        {entries.map(([name, qty]) => (
          <div className="invf-pd-location-row" key={name}>
            <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{name}</span>
            <span style={{ fontWeight: 700, color: "#1A1A1A" }}>{qty}</span>
          </div>
        ))}
      </div>
      {levelsTruncated && (
        <div className="invf-pd-chart-subtitle" style={{ marginTop: 10, marginBottom: 0 }}>
          {t.locationBreakdownTruncatedNote}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grafik 1: Satış geçmişi — son 12 haftanın haftalık toplam satış adedi.
// ---------------------------------------------------------------------------
const HISTORY_WEEKS = 12;
const CHART_W = 620;
const CHART_H = 230;
const PAD_L = 44;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 34;
const AXIS_FONT_SIZE = 13.5;
const TOOLTIP_FONT_SIZE = 14;

export function SalesHistoryChart(props: { salesByDay: Record<string, number> | null; locale: Locale; t: Dictionary }) {
  const { salesByDay, locale, t } = props;
  const [hover, setHover] = useState<number | null>(null);

  const weeks = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const buckets: { start: Date; units: number }[] = [];
    for (let i = HISTORY_WEEKS - 1; i >= 0; i--) {
      const start = new Date(todayMidnight.getTime() - (i + 1) * 7 * 86_400_000 + 86_400_000);
      buckets.push({ start, units: 0 });
    }
    if (salesByDay) {
      for (const [dayStr, qty] of Object.entries(salesByDay)) {
        const day = new Date(dayStr + "T00:00:00");
        const ageDays = Math.floor((todayMidnight.getTime() - day.getTime()) / 86_400_000);
        if (ageDays < 0 || ageDays >= HISTORY_WEEKS * 7) continue;
        const weekIndex = HISTORY_WEEKS - 1 - Math.floor(ageDays / 7);
        if (buckets[weekIndex]) buckets[weekIndex].units += qty;
      }
    }
    return buckets;
  }, [salesByDay]);

  const hasAnySales = weeks.some((w) => w.units > 0);

  if (!salesByDay || !hasAnySales) {
    return (
      <div className="invf-pd-chart-card">
        <div className="invf-pd-chart-title">{t.chartHistoryTitle}</div>
        <div className="invf-pd-chart-subtitle">{t.chartHistorySubtitle}</div>
        <div className="invf-pd-empty">{t.chartHistoryEmpty}</div>
      </div>
    );
  }

  const yMax = niceMax(Math.max(...weeks.map((w) => w.units)));
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const gap = 4;
  const barW = Math.min(24, plotW / HISTORY_WEEKS - gap);
  const slot = plotW / HISTORY_WEEKS;

  const yToPx = (v: number) => PAD_T + plotH - (v / yMax) * plotH;
  const baseline = PAD_T + plotH;

  const yTicks = [0, Math.round(yMax / 2), yMax].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.chartHistoryTitle}</div>
      <div className="invf-pd-chart-subtitle">{t.chartHistorySubtitle}</div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height={CHART_H} role="img" aria-label={t.chartHistorySubtitle}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={CHART_W - PAD_R} y1={yToPx(tick)} y2={yToPx(tick)} stroke={AXIS_GRAY} strokeWidth={1} />
            <text x={PAD_L - 8} y={yToPx(tick) + 5} className="invf-pd-axis" fontSize={AXIS_FONT_SIZE} fill={TICK_TEXT} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const h = (w.units / yMax) * plotH;
          const yTop = baseline - h;
          const r = Math.min(4, h / 2);
          const showLabel = i === 0 || i === weeks.length - 1 || i === Math.floor(weeks.length / 2);
          const path =
            h <= 0
              ? ""
              : `M ${x} ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop} L ${x + barW - r} ${yTop} Q ${x + barW} ${yTop} ${x + barW} ${yTop + r} L ${x + barW} ${baseline} L ${x} ${baseline} Z`;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((cur) => (cur === i ? null : cur))}
              tabIndex={0}
            >
              <rect x={x - gap / 2} y={PAD_T} width={barW + gap} height={plotH} fill="transparent" />
              {h > 0 && <path d={path} fill={hover === i ? "#026B4F" : ACCENT} />}
              {showLabel && (
                <text x={x + barW / 2} y={CHART_H - 8} className="invf-pd-axis" fontSize={AXIS_FONT_SIZE} fill={TICK_TEXT} textAnchor="middle">
                  {shortDateText(w.start, locale)}
                </text>
              )}
              {hover === i && (
                <>
                  <rect
                    x={Math.min(Math.max(x + barW / 2 - 56, PAD_L), CHART_W - PAD_R - 112)}
                    y={Math.max(yTop - 36, 2)}
                    width={112}
                    height={28}
                    rx={7}
                    fill="#1A1A1A"
                  />
                  <text
                    x={Math.min(Math.max(x + barW / 2, PAD_L + 56), CHART_W - PAD_R - 56)}
                    y={Math.max(yTop - 17, 20)}
                    fontSize={TOOLTIP_FONT_SIZE}
                    fontWeight={700}
                    fill="#FFFFFF"
                    textAnchor="middle"
                  >
                    {w.units} {t.chartHistoryUnitsSuffix}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grafik 2: Stok tükenme projeksiyonu.
// ---------------------------------------------------------------------------
const PROJECTION_HORIZON_DAYS = 90;

export function StockProjectionChart(props: {
  available: number;
  dailyRate: number | null;
  stockoutInDays: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const { available, dailyRate, stockoutInDays, locale, t } = props;
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  let empty: string | null = null;
  if (available <= 0) empty = t.chartProjectionEmptyOutOfStock;
  else if (dailyRate == null) empty = t.chartProjectionEmptyNoSales;
  else if (dailyRate <= 0 || stockoutInDays == null || stockoutInDays > PROJECTION_HORIZON_DAYS) {
    empty = t.chartProjectionEmptyNoRunway(PROJECTION_HORIZON_DAYS);
  }

  if (empty) {
    return (
      <div className="invf-pd-chart-card">
        <div className="invf-pd-chart-title">{t.chartProjectionTitle}</div>
        <div className="invf-pd-chart-subtitle">{t.chartProjectionSubtitle}</div>
        <div className="invf-pd-empty">{empty}</div>
      </div>
    );
  }

  const daysToZero = Math.max(stockoutInDays as number, 0.1);
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const xMax = daysToZero;
  const yMax = niceMax(available);

  const xToPx = (d: number) => PAD_L + (d / xMax) * plotW;
  const yToPx = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

  const yTicks = [0, Math.round(yMax / 2), yMax].filter((v, i, arr) => arr.indexOf(v) === i);
  const xTicks = [0, daysToZero];

  const stockoutDate = stockoutDateText(daysToZero, locale);

  function handleMove(e: PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const day = Math.min(Math.max(((px - PAD_L) / plotW) * xMax, 0), xMax);
    setHoverDay(day);
  }

  const hoverStock = hoverDay != null ? Math.max(available - (dailyRate as number) * hoverDay, 0) : null;

  return (
    <div className="invf-pd-chart-card">
      <div className="invf-pd-chart-title">{t.chartProjectionTitle}</div>
      <div className="invf-pd-chart-subtitle">{t.chartProjectionSubtitle}</div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        height={CHART_H}
        role="img"
        aria-label={t.chartProjectionSubtitle}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverDay(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={CHART_W - PAD_R} y1={yToPx(tick)} y2={yToPx(tick)} stroke={AXIS_GRAY} strokeWidth={1} />
            <text x={PAD_L - 8} y={yToPx(tick) + 5} className="invf-pd-axis" fontSize={AXIS_FONT_SIZE} fill={TICK_TEXT} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={xToPx(tick)}
            y={CHART_H - 8}
            className="invf-pd-axis" fontSize={AXIS_FONT_SIZE}
            fill={TICK_TEXT}
            textAnchor={i === 0 ? "start" : "end"}
          >
            {i === 0 ? t.chartProjectionTodayLabel : stockoutDate}
          </text>
        ))}

        <line
          x1={xToPx(0)}
          y1={yToPx(available)}
          x2={xToPx(daysToZero)}
          y2={yToPx(0)}
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {hoverDay != null && hoverStock != null && (
          <>
            <line x1={xToPx(hoverDay)} x2={xToPx(hoverDay)} y1={PAD_T} y2={PAD_T + plotH} stroke="#B4B4B4" strokeWidth={1} />
            <circle cx={xToPx(hoverDay)} cy={yToPx(hoverStock)} r={5} fill={ACCENT} stroke="#FFFFFF" strokeWidth={2} />
            <rect
              x={Math.min(Math.max(xToPx(hoverDay) - 58, PAD_L), CHART_W - PAD_R - 116)}
              y={Math.max(yToPx(hoverStock) - 38, 2)}
              width={116}
              height={28}
              rx={7}
              fill="#1A1A1A"
            />
            <text
              x={Math.min(Math.max(xToPx(hoverDay), PAD_L + 58), CHART_W - PAD_R - 58)}
              y={Math.max(yToPx(hoverStock) - 19, 20)}
              fontSize={TOOLTIP_FONT_SIZE}
              fontWeight={700}
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {Math.round(hoverStock)} {t.chartProjectionAxisUnit}
            </text>
          </>
        )}

        <circle cx={xToPx(daysToZero)} cy={yToPx(0)} r={5} fill={CRITICAL} stroke="#FFFFFF" strokeWidth={2} />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 700, color: CRITICAL, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: CRITICAL, display: "inline-block", flexShrink: 0 }} />
        {t.chartProjectionStockoutLabel(stockoutDate)}
      </div>
    </div>
  );
}
