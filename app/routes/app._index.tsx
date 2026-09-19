import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { getForecastGroups } from "../lib/forecastCache.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeedbackButton } from "../components/FeedbackButton";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const { groups, computedAt, fromCache } = await getForecastGroups(session.shop, admin, {
    forceRefresh,
  });

  return { ...groups, computedAt: computedAt.toISOString(), fromCache };
};

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

// forecastCache.server.ts içindeki REORDER_ALERT_DAYS ile aynı olmalı.
const URGENT_DAYS = 14;

// Satış hızı birimi seçilirken sayının bu değerin altına düşmemesi hedeflenir.
// Böylece "0,8" gibi okunması zor ondalıklar ekrana hiç çıkmaz.
const RATE_MIN_READABLE = 3;

// Arama kutusu için gecikme. Her tuş vuruşunda değil, kullanıcı durduğunda
// filtreleme yapılır. Büyük ürün sayısında (1000+) gereksiz yeniden
// hesaplamaları önlemek için eklendi.
const SEARCH_DEBOUNCE_MS = 220;

// "Yukarı çık" butonunun belirmesi için gereken kaydırma miktarı (piksel).
const SCROLL_TOP_THRESHOLD = 400;

type Category = "out" | "soon" | "dead" | "nodata";
type Filter = "all" | "urgent" | Category;

type CategoryMeta = {
  label: string;
  hint: string;
  accent: string;
  soft: string;
  text: string;
};

const CATEGORY_META: { [K in Category]: CategoryMeta } = {
  out: {
    label: "Stok bitti",
    hint: "Şu an satılamıyor",
    accent: "#D72C0D",
    soft: "#FEE9E8",
    text: "#8E1F0B",
  },
  soon: {
    label: "Azalıyor",
    hint: "Yakında sipariş verin",
    accent: "#E8A317",
    soft: "#FFF4E0",
    text: "#7A5100",
  },
  dead: {
    label: "Satılmıyor",
    hint: "Uzun süredir satış yok",
    accent: "#2C6ECB",
    soft: "#EAF4FF",
    text: "#1F4C8C",
  },
  nodata: {
    label: "Tahmin yok",
    hint: "Yeterli satış geçmişi yok",
    accent: "#8A8A8A",
    soft: "#F1F1F1",
    text: "#4A4A4A",
  },
};

const CATEGORY_ORDER: Category[] = ["out", "soon", "dead", "nodata"];

// "Tüm ürünler" kartının rengi — herhangi bir kategoriyle çakışmasın diye
// Shopify'ın standart yeşili kullanıldı.
const ALL_PRODUCTS_ACCENT = "#008060";

// Sütunlar: Ürün · Durum · Stok · Satış hızı · Ne zaman biter?
const GRID_COLUMNS =
  "minmax(220px, 2.2fr) 150px minmax(80px, 100px) minmax(150px, 180px) minmax(210px, 1.4fr)";

const PAGE_CSS = `
@keyframes invf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---------------------------- Uyarı kutusu ---------------------------- */
.invf-alert {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px 18px 22px;
  border-radius: 14px;
  border: 2px solid var(--invf-alert-accent);
  border-left: 7px solid var(--invf-alert-accent);
  background: var(--invf-alert-soft);
  box-shadow: 0 2px 10px rgba(0,0,0,0.07);
}
.invf-alert--calm {
  border-width: 1px;
  border-left-width: 5px;
  box-shadow: none;
  padding-top: 14px;
  padding-bottom: 14px;
}
.invf-alert-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--invf-alert-accent);
  color: #FFFFFF;
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}
.invf-alert--calm .invf-alert-icon { width: 32px; height: 32px; font-size: 18px; }
.invf-alert-body { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.invf-alert-title {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--invf-alert-text);
}
.invf-alert--calm .invf-alert-title { font-size: 15px; font-weight: 700; }
.invf-alert-desc { font-size: 14px; color: #3D3D3D; line-height: 1.4; }
.invf-alert--calm .invf-alert-desc { font-size: 13px; color: #5C5C5C; }
.invf-alert-btn {
  all: unset;
  box-sizing: border-box;
  flex-shrink: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 22px;
  border-radius: 10px;
  background: var(--invf-alert-accent);
  color: #FFFFFF;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  transition: filter 120ms ease;
}
.invf-alert-btn:hover { filter: brightness(1.08); }

/* --------------------------- Özet kartları --------------------------- */
/* Asla 3 sütuna düşmez: ya 4 ya 2. Aksi halde 4. kart tek başına kalıyor. */
.invf-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 1040px) {
  .invf-summary { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}

/* Basılabilir olduğu belli olsun diye hover'da hafifçe kalkıyor + gölge
   büyüyor + kenarlık kategori rengine dönüyor. Sayısı 0 olan (tıklanamaz)
   kartlarda bu efekt bilerek yok.
   ÖNEMLİ: kartın kendi inline style'ı "all: unset" içeriyor (bkz.
   SummaryCard). Satır içi stil, önem derecesi (!important) olmayan dış
   CSS kurallarını HER ZAMAN ezer — pseudo-class fark etmeksizin. Bu
   yüzden hover'ın gerçekten görünmesi için bu kurallara !important şart.
   Aynı sebeple: bu sınıf hem kategori kartları hem "Tüm ürünler" kartı
   (invf-allcard) tarafından paylaşılıyor, tutarlı hover/focus için. */
.invf-summary-card {
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease !important;
}
.invf-summary-card:hover:not(.invf-summary-card--empty) {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
  border-color: var(--invf-card-accent) !important;
}
.invf-summary-card:focus-visible:not(.invf-summary-card--empty) {
  outline: 2px solid var(--invf-card-accent) !important;
  outline-offset: 2px !important;
}
.invf-summary-card--empty { cursor: default; }

/* "Tüm ürünler" kartı: diğerleriyle aynı görsel dil (kart + üst şerit),
   ama kare değil geniş/yatay. Dar ekranda dikeyleşir — bu yalnızca
   media query ile mümkün, bu yüzden layout'un flex-direction'ı burada
   !important ile eziliyor (inline "all: unset" nedeniyle aksi halde
   üzerine yazılamaz, bkz. yukarıdaki açıklama). */
@media (max-width: 560px) {
  .invf-allcard {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 6px !important;
  }
}

.invf-hint { font-size: 12.5px; color: #6B6B6B; margin-top: -4px; }

.invf-foot {
  padding: 12px 20px 16px;
  border-top: 1px solid #F1F1F1;
  font-size: 12px;
  color: #7A7A7A;
  line-height: 1.45;
}

/* ---------------------------- Liste kartı ---------------------------- */
.invf-list-card {
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  overflow: hidden;
  scroll-margin-top: 16px;
}
.invf-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 14px;
}
/* Başlık satırı: solda başlık/özet (süzgeç adı zaten burada yazıyor),
   sağda eylem butonları (Excel indir / temizle). */
.invf-toolbar-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.invf-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.invf-clear-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 9px;
  border: 1px solid #008060;
  background: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #0C5132;
  white-space: nowrap;
}
.invf-clear-btn:hover { background: #E3F1DF; }
/* Excel indir butonu: dolu, Excel'in koyu yeşiline yakın renk. İkon
   kaldırıldı (küçük boyutta tanınmıyordu); metin kısa tutuldu çünkü
   hangi ürünleri indirdiği zaten hemen üstteki "Süzgeç: ..." satırında
   yazıyor — tekrar etmeye gerek yok, tam açıklama title tooltip'inde. */
.invf-export-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border-radius: 9px;
  border: 1.5px solid #14572E;
  background: #1F7244;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}
.invf-export-btn:hover { background: #195C38; }
.invf-search { position: relative; }
.invf-search input {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 14px 11px 40px;
  border: 1px solid #D4D4D4;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  color: #1A1A1A;
  background: #FFFFFF;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.invf-search input::placeholder { color: #7A7A7A; }
.invf-search input:focus {
  border-color: #008060;
  box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.15);
}
.invf-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  pointer-events: none;
}

/* ------------------------------ Satırlar ------------------------------ */
.invf-head, .invf-row {
  display: grid;
  grid-template-columns: ${GRID_COLUMNS};
  column-gap: 28px;
  align-items: center;
  padding: 16px 20px;
}
.invf-head {
  background: #FAFAFA;
  border-top: 1px solid #EBEBEB;
  border-bottom: 1px solid #EBEBEB;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #4A4A4A;
  padding-top: 11px;
  padding-bottom: 11px;
}
.invf-row {
  border-bottom: 1px solid #F1F1F1;
  transition: background 120ms ease;
}
.invf-row:last-child { border-bottom: none; }
.invf-row:hover { background: #FBFCFC; }
.invf-label { display: none; }

.invf-num {
  font-size: 16px;
  font-weight: 700;
  color: #1A1A1A;
  line-height: 1.2;
}
.invf-num small { font-size: 12px; font-weight: 600; color: #6B6B6B; margin-left: 3px; }
.invf-muted { font-size: 13px; color: #6B6B6B; }

.invf-days-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}
.invf-days-chip small { font-size: 11.5px; font-weight: 700; }

.invf-sub {
  display: block;
  margin-top: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #5C5C5C;
}
.invf-note {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #7A7A7A;
}

.invf-pagebtn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-pagebtn:hover { background: #F7F7F7; }
.invf-pagebtn[disabled] { opacity: 0.4; cursor: default; }

.invf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 20px;
  border-top: 1px solid #EBEBEB;
  text-align: center;
}

/* --------------------------- Yukarı çık butonu --------------------------- */
.invf-scrolltop-btn {
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease !important;
}
.invf-scrolltop-btn:hover {
  transform: translateY(-3px) scale(1.06) !important;
  box-shadow: 0 10px 22px rgba(0,0,0,0.28) !important;
  background: #026B4F !important;
}

/* ---------------------------------------------------------------------
   Dar ekran (<= 900px): her satır ayrı bir kart.
   --------------------------------------------------------------------- */
@media (max-width: 900px) {
  .invf-head { display: none; }

  .invf-row {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "product product"
      "status  status"
      "stock   rate"
      "runway  runway";
    column-gap: 10px;
    row-gap: 12px;
    align-items: stretch;
    padding: 14px;
    margin: 0 14px 12px;
    border: 1px solid #ECECEC;
    border-radius: 12px;
    background: #FFFFFF;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .invf-row:last-child { margin-bottom: 14px; }
  .invf-row:hover { background: #FFFFFF; }

  .invf-product { grid-area: product; }
  .invf-c-status { grid-area: status; }
  .invf-c-stock  { grid-area: stock; }
  .invf-c-rate   { grid-area: rate; }
  .invf-wide     { grid-area: runway; }

  .invf-c-status .invf-label { display: none; }

  .invf-c-stock, .invf-c-rate {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    min-height: 62px;
    background: #FAFBFB;
    border: 1px solid #F0F0F0;
    border-radius: 10px;
    padding: 9px 11px;
  }

  .invf-wide { padding-top: 2px; border-top: 1px dashed #EDEDED; }

  .invf-label {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #757575;
  }

  .invf-toolbar { padding: 14px; }
  .invf-foot { padding: 12px 14px 14px; }

  .invf-alert { flex-wrap: wrap; gap: 12px; padding: 16px 16px 16px 18px; }
  .invf-alert-title { font-size: 17px; }
  .invf-alert-btn { flex: 1 1 100%; justify-content: center; }
}

@media (max-width: 560px) {
  .invf-summary { gap: 8px; }
  .invf-row { margin: 0 10px 10px; padding: 13px; }
  .invf-row:last-child { margin-bottom: 12px; }
  .invf-toolbar { padding: 12px; }
  .invf-refresh-btn { width: 100%; justify-content: center; }
  .invf-toolbar-actions { flex-direction: column; width: 100%; }
  .invf-clear-btn, .invf-export-btn { flex: 1 1 100%; justify-content: center; }
  .invf-scrolltop-btn {
    bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
    right: 16px !important;
  }
}

/* ------------------------------ Alt boşluk ------------------------------ */
/* Sayfanın en altı için: sol altta geri bildirim, sağ altta (kaydırınca)
   yukarı çık butonu sabit duruyor. Bu boşluk olmadan, sayfa sonuna kadar
   kaydırıldığında son ürün kartı bu butonların altında kalıp
   okunamıyordu. Mobilde butonlar ekrana daha yakın durduğu için pay
   biraz daha artırılıyor. */
.invf-page-content {
  padding-bottom: 88px;
}
@media (max-width: 560px) {
  .invf-page-content { padding-bottom: 104px; }
}
`;

// ---------------------------------------------------------------------------
// Biçimlendirme yardımcıları
// ---------------------------------------------------------------------------

function dimStyle(dimmed: boolean): CSSProperties {
  return {
    opacity: dimmed ? 0.45 : 1,
    transition: "opacity 150ms ease",
    pointerEvents: dimmed ? "none" : "auto",
  };
}

function initials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["the", "a", "an"].includes(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * Satış hızını ürüne göre en okunabilir birimde yazar.
 * Hızlı satan ürün günlük, orta hızlı haftalık, yavaş satan aylık gösterilir.
 * Birim her zaman metnin içinde yazılı olduğu için satırlar karışmaz.
 */
function rateText(dailyRate: number | null | undefined): string {
  if (dailyRate == null) return "—";
  if (dailyRate <= 0) return "Satış yok";

  if (dailyRate >= RATE_MIN_READABLE) {
    return `Günde ~${Math.round(dailyRate)} adet`;
  }

  const weekly = dailyRate * 7;
  if (weekly >= RATE_MIN_READABLE) {
    return `Haftada ~${Math.round(weekly)} adet`;
  }

  const monthly = dailyRate * 30;
  if (monthly >= 1) {
    return `Ayda ~${Math.round(monthly)} adet`;
  }
  return "Ayda 1'den az";
}

// "Güven" teknik bir terim; düz cümleye çeviriyoruz.
function confidenceText(value: string): string | null {
  if (value === "low") return "Kaba tahmin — satış geçmişi az";
  if (value === "medium") return "Tahmin yaklaşık";
  if (value === "high") return "Tahmin güvenilir";
  return null;
}

function stockoutDateText(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// CSV dışa aktarma
// ---------------------------------------------------------------------------
// Buton her zaman "o an ekranda görünen (süzülmüş/aranmış) liste"yi indirir.
// Kategori başına ayrı buton yok — kart tıklayıp süzgeci değiştirmek zaten
// aynı işi görüyor, buton sadece aktif süzgece göre neyi indireceğine karar
// veriyor. Sayfalama sadece görünümü etkiler; export her zaman süzülmüş
// KÜMENİN TAMAMINI indirir (sadece o an açık olan 25 satırı değil).
// Dosya biçimi CSV'dir (gerçek .xlsx değil) ama Excel'de doğrudan açıldığı
// için buton metninde "Excel indir" deniyor — mağaza sahibi için tanıdık.

function slugifyFilterName(filter: Filter): string {
  if (filter === "all") return "tum-urunler";
  if (filter === "urgent") return "acil-urunler";
  return CATEGORY_META[filter].label
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// item burada bilinçli olarak `any`: loader'ın döndürdüğü satır tipi bu
// dosyada zaten hiçbir yerde katı biçimde tanımlanmamış (RunwayCell'deki
// `String(item.confidence ?? "")` kullanımıyla aynı yaklaşım).
function runwayCsvText(item: any, category: Category): string {
  if (category === "out") return "Stok bitti";
  if (category === "dead") return "Uzun süredir satılmıyor";
  if (category === "nodata") return "Tahmin için yeterli satış geçmişi yok";
  const days = item.stockoutInDays;
  if (days == null) return "—";
  const rounded = Math.round(days);
  if (rounded <= 0) return "Bugün bitebilir";
  return `${rounded} gün sonra (${stockoutDateText(rounded)} civarı)`;
}

function buildCsv(rows: Array<{ item: any; category: Category }>): string {
  const headers = ["Ürün", "Varyant", "Durum", "Stok", "Satış Hızı", "Ne Zaman Biter", "Not"];
  const lines = [headers.map(csvField).join(",")];

  for (const { item, category } of rows) {
    const note = category === "soon" ? confidenceText(String(item.confidence ?? "")) ?? "" : "";
    const row = [
      item.productTitle ?? "",
      item.variantTitle && item.variantTitle !== "Default Title" ? item.variantTitle : "",
      CATEGORY_META[category].label,
      String(item.available ?? ""),
      rateText(item.dailyRate),
      runwayCsvText(item, category),
      note,
    ];
    lines.push(row.map(csvField).join(","));
  }

  return lines.join("\r\n");
}

function downloadCsv(csv: string, fileName: string) {
  // Excel'de Türkçe karakterlerin bozulmaması için UTF-8 BOM ekleniyor.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Uyarı / durum kutusu
// ---------------------------------------------------------------------------

type AlertTone = "critical" | "warning" | "success";

type AlertBoxProps = {
  tone: AlertTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ALERT_TONES: { [K in AlertTone]: { accent: string; soft: string; text: string; icon: string } } =
{
  critical: { accent: "#D72C0D", soft: "#FFF1F0", text: "#8E1F0B", icon: "!" },
  warning: { accent: "#B98900", soft: "#FFF8E8", text: "#6B4700", icon: "!" },
  success: { accent: "#008060", soft: "#F1F8F4", text: "#0C5132", icon: "✓" },
};

function AlertBox(props: AlertBoxProps) {
  const tone = ALERT_TONES[props.tone];
  const calm = props.tone === "success";

  const vars = {
    "--invf-alert-accent": tone.accent,
    "--invf-alert-soft": tone.soft,
    "--invf-alert-text": tone.text,
  } as CSSProperties;

  return (
    <div className={calm ? "invf-alert invf-alert--calm" : "invf-alert"} style={vars} role="status">
      <span className="invf-alert-icon" aria-hidden="true">
        {tone.icon}
      </span>
      <div className="invf-alert-body">
        <span className="invf-alert-title">{props.title}</span>
        {props.description && <span className="invf-alert-desc">{props.description}</span>}
      </div>
      {props.actionLabel && props.onAction && (
        <button type="button" className="invf-alert-btn" onClick={props.onAction}>
          {props.actionLabel}
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kartların ortak üst şeridi
// ---------------------------------------------------------------------------
// Bilerek ayrı, bağımsız bir eleman: kartın "border"/"active" durumuyla
// karışıp kaybolmasın diye. Rengi active durumuna hiç bakmaz, her zaman
// aynı kalır — sadece "empty" (sayısı 0, tıklanamaz) kartlarda griye döner.

function CardStripe(props: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: props.color,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Özet kartı (tıklanınca listeyi filtreler)
// ---------------------------------------------------------------------------

type SummaryCardProps = {
  category: Category;
  count: number;
  active: boolean;
  onClick: () => void;
};

function SummaryCard(props: SummaryCardProps) {
  const meta = CATEGORY_META[props.category];
  // Sayısı 0 olan kart tıklanınca boş listeye düşürüyordu; tıklanamaz yapıldı.
  const empty = props.count === 0;

  const accentVar = { "--invf-card-accent": meta.accent } as CSSProperties;

  const style: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    cursor: empty ? "default" : "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "14px 14px 12px",
    borderRadius: 12,
    background: props.active ? meta.soft : "#FFFFFF",
    border: props.active ? `2px solid ${meta.accent}` : "1px solid #E3E3E3",
    opacity: empty ? 0.55 : 1,
    fontFamily: "inherit",
    minWidth: 0,
    ...accentVar,
  };

  const className = [
    "invf-summary-card",
    props.active ? "invf-summary-card--active" : "",
    empty ? "invf-summary-card--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={empty ? undefined : props.onClick}
      aria-pressed={props.active}
      aria-disabled={empty}
    >
      <CardStripe color={empty ? "#DCDCDC" : meta.accent} />
      <span style={{ fontSize: 13, fontWeight: 700, color: empty ? "#6B6B6B" : meta.text }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A" }}>
        {props.count}
      </span>
      <span style={{ fontSize: 12, color: "#5C5C5C", lineHeight: 1.35 }}>{meta.hint}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// "Tüm ürünler" kartı — diğer kartlarla aynı görsel dil, geniş/yatay
// ---------------------------------------------------------------------------

type AllProductsCardProps = {
  count: number;
  showingAll: boolean;
  onClick: () => void;
};

function AllProductsCard(props: AllProductsCardProps) {
  const accentVar = { "--invf-card-accent": ALL_PRODUCTS_ACCENT } as CSSProperties;

  const style: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "14px 18px 12px",
    borderRadius: 12,
    background: props.showingAll ? "#F1F8F4" : "#FFFFFF",
    border: props.showingAll ? `2px solid ${ALL_PRODUCTS_ACCENT}` : "1px solid #E3E3E3",
    fontFamily: "inherit",
    ...accentVar,
  };

  return (
    <button
      type="button"
      className="invf-summary-card invf-allcard"
      style={style}
      onClick={props.onClick}
      aria-pressed={props.showingAll}
    >
      <CardStripe color={ALL_PRODUCTS_ACCENT} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Tüm ürünler</span>
        <span style={{ fontSize: 12.5, color: "#6B6B6B" }}>
          {props.showingAll ? "Şu an bunu görüntülüyorsunuz" : "Süzgeci kaldır, hepsini gör"}
        </span>
      </div>
      {/* Diğer kartlardaki büyük/kalın/siyah sayı stiliyle birebir aynı —
          önceki sürümde yeşil rozet içindeydi, tutarsız duruyordu. */}
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A", flexShrink: 0 }}>
        {props.count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Üst şerit: yenile butonu + son güncelleme
// ---------------------------------------------------------------------------

type RefreshBarProps = {
  lastUpdated: string;
  isRefreshing: boolean;
  justRefreshed: boolean;
  onRefresh: () => void;
};

function RefreshBar(props: RefreshBarProps) {
  const buttonStyle: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: props.isRefreshing ? "wait" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 10,
    background: props.isRefreshing ? "#4F9E86" : "#008060",
    color: "#FFFFFF",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
  };

  const iconStyle: CSSProperties = {
    display: "inline-block",
    fontSize: 16,
    lineHeight: 1,
    animation: props.isRefreshing ? "invf-spin 0.9s linear infinite" : "none",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "13px 16px",
        borderRadius: 12,
        background: "#FFFFFF",
        border: "1px solid #E3E3E3",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: 2, ...dimStyle(props.isRefreshing) }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
          Satış hızınıza göre hangi ürünün ne zaman biteceği
        </span>
        <span style={{ fontSize: 12.5, color: "#6B6B6B" }}>
          Son güncelleme: {props.lastUpdated}
          {props.justRefreshed && !props.isRefreshing && (
            <span style={{ marginLeft: 8, fontWeight: 600, color: "#008060" }}>
              ✓ Az önce güncellendi
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        className="invf-refresh-btn"
        style={buttonStyle}
        onClick={props.onRefresh}
        disabled={props.isRefreshing}
      >
        <span style={iconStyle}>↻</span>
        {props.isRefreshing ? "Yenileniyor…" : "Verileri yenile"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Küçük parçalar
// ---------------------------------------------------------------------------

function StatusPill(props: { category: Category }) {
  const meta = CATEGORY_META[props.category];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        color: meta.text,
        background: meta.soft,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: meta.accent }} />
      {meta.label}
    </span>
  );
}

function CellLabel(props: { children: ReactNode }) {
  return <span className="invf-label">{props.children}</span>;
}

function RunwayCell(props: { days: number; confidence: string }) {
  const { days } = props;
  const note = confidenceText(props.confidence);

  // 0 güne yuvarlanan tahmin "≈0 gün sonra" olarak okunuyordu; düz cümleye çevrildi.
  if (days <= 0) {
    return (
      <div>
        <span className="invf-days-chip" style={{ background: "#FEE9E8", color: "#C4210B" }}>
          Bugün bitebilir
        </span>
        {note && <span className="invf-note">{note}</span>}
      </div>
    );
  }

  const bg = days <= 7 ? "#FEE9E8" : days <= 21 ? "#FFF4E0" : "#E3F1DF";
  const fg = days <= 7 ? "#C4210B" : days <= 21 ? "#8A5A00" : "#0C5132";

  return (
    <div>
      <span className="invf-days-chip" style={{ background: bg, color: fg }}>
        ≈{days}
        <small>GÜN SONRA</small>
      </span>
      <span className="invf-sub">{stockoutDateText(days)} civarı</span>
      {note && <span className="invf-note">{note}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

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

  const navigate = useNavigate();
  const navigation = useNavigation();
  const isRefreshing = navigation.state === "loading";

  const [filter, setFilter] = useState<Filter>("all");
  // queryInput: kullanıcının o an yazdığı ham metin (input'a bağlı, gecikmesiz).
  // query: debounce'dan geçmiş, filtrelemede kullanılan değer.
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [queryInput]);

  // Belli bir miktar aşağı kaydırılınca "yukarı çık" butonu beliriyor.
  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const refresh = () => navigate("?refresh=1");

  const allRows = useMemo(
    () => [
      ...outOfStock.map((item) => ({ item, category: "out" as Category })),
      ...soonToStockout.map((item) => ({ item, category: "soon" as Category })),
      ...deadStock.map((item) => ({ item, category: "dead" as Category })),
      ...insufficientData.map((item) => ({ item, category: "nodata" as Category })),
    ],
    [outOfStock, soonToStockout, deadStock, insufficientData],
  );

  const counts: { [K in Category]: number } = {
    out: outOfStock.length,
    soon: soonToStockout.length,
    dead: deadStock.length,
    nodata: insufficientData.length,
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return allRows.filter(({ item, category }) => {
      if (filter === "urgent") {
        const urgent =
          category === "out" ||
          (category === "soon" && Math.round(item.stockoutInDays ?? Infinity) <= URGENT_DAYS);
        if (!urgent) return false;
      } else if (filter !== "all" && category !== filter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.productTitle} ${item.variantTitle}`.toLocaleLowerCase("tr-TR");
      return haystack.includes(q);
    });
  }, [allRows, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeFilter(next: Filter) {
    setFilter((prev) => (prev === next ? "all" : next));
    setPage(1);
  }

  function clearFilter() {
    setFilter("all");
    setQueryInput("");
    setQuery("");
    setPage(1);
  }

  function showUrgent() {
    setFilter("urgent");
    setQueryInput("");
    setQuery("");
    setPage(1);
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function handleExport() {
    const csv = buildCsv(filteredRows);
    const label = slugifyFilterName(filter);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `envanter-${label}-${dateStr}.csv`);
  }

  const lastUpdated = new Date(computedAt).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ---- Uyarı kutusu metni --------------------------------------------------
  const urgentSoonCount = Math.max(0, reorderAlerts.length - outOfStock.length);
  const alertParts: string[] = [];
  if (outOfStock.length > 0) {
    alertParts.push(`${outOfStock.length} ürünün stoğu bitti`);
  }
  if (urgentSoonCount > 0) {
    alertParts.push(`${urgentSoonCount} ürün ${URGENT_DAYS} gün içinde bitiyor`);
  }
  const alertDescription = alertParts.length > 0 ? `${alertParts.join(", ")}.` : undefined;

  // ---- Süzgeç durumu -------------------------------------------------------
  const trimmedQuery = query.trim();
  const activeFilterLabel =
    filter === "all" ? null : filter === "urgent" ? "Acil ürünler" : CATEGORY_META[filter].label;
  const isFiltered = activeFilterLabel !== null || trimmedQuery.length > 0;

  const subtitleParts: string[] = [];
  if (isFiltered) {
    subtitleParts.push(`${allRows.length} üründen ${filteredRows.length} tanesi gösteriliyor`);
    if (activeFilterLabel) subtitleParts.push(`Süzgeç: ${activeFilterLabel}`);
    if (trimmedQuery) subtitleParts.push(`Arama: "${trimmedQuery}"`);
  } else {
    subtitleParts.push(`${allRows.length} ürün`);
    if (allRows.length > 0) subtitleParts.push("en acil olanlar en üstte");
  }

  // Excel indir butonunun tooltip'inde ne indirdiğini söylemesi için
  // (buton metninde değil — hemen üstteki subtitle'da zaten yazıyor).
  const filterContextLabel = (() => {
    const parts: string[] = [];
    if (activeFilterLabel) parts.push(activeFilterLabel);
    if (trimmedQuery) parts.push(`"${trimmedQuery}"`);
    return parts.length > 0 ? parts.join(" · ") : "Tüm ürünler";
  })();

  // Köşeye sıkışık durmasın, listeye biraz daha yakın dursun diye sağdan
  // boşluk 24 yerine 44 — hâlâ sabit (fixed) ama tam köşede değil.
  const scrollTopButtonStyle: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "fixed",
    bottom: 32,
    right: 44,
    zIndex: 40,
    width: 48,
    height: 48,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#008060",
    color: "#FFFFFF",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  };

  return (
    <>
      <s-page heading="Envanter Tahmini">
        <style>{PAGE_CSS}</style>

        <s-stack gap="base">
          <RefreshBar
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            justRefreshed={!fromCache}
            onRefresh={refresh}
          />

          <div
            className="invf-page-content"
            style={{ display: "flex", flexDirection: "column", gap: 14, ...dimStyle(isRefreshing) }}
          >
            {/* Acil durum varsa kırmızı uyarı, yoksa sessiz bir onay satırı.
                Hiçbir şey göstermemek "uygulama çalıştı mı?" sorusunu doğuruyordu. */}
            {reorderAlerts.length > 0 ? (
              <AlertBox
                tone={outOfStock.length > 0 ? "critical" : "warning"}
                title={`${reorderAlerts.length} ürün için sipariş vakti geldi`}
                description={alertDescription}
                actionLabel="Acil ürünleri göster"
                onAction={showUrgent}
              />
            ) : (
              allRows.length > 0 && (
                <AlertBox
                  tone="success"
                  title="Şu an sipariş verilmesi gereken ürün yok"
                  description={`Hiçbir ürünün stoğu ${URGENT_DAYS} gün içinde bitmiyor.`}
                />
              )
            )}

            <div className="invf-summary">
              {CATEGORY_ORDER.map((cat) => (
                <SummaryCard
                  key={cat}
                  category={cat}
                  count={counts[cat]}
                  active={filter === cat}
                  onClick={() => changeFilter(cat)}
                />
              ))}
            </div>

            {/* "Tüm ürünler" bilinçli olarak 4'lü kart grid'inin İÇİNDE değil,
                altında — 5. kart yapmak hem kavramsal karışıklık yaratırdı
                (kategorilerin toplamı bir kategori değildir) hem de grid'in
                "asla 3 sütuna düşmez" düzenini bozardı. */}
            {allRows.length > 0 && (
              <AllProductsCard
                count={allRows.length}
                showingAll={!isFiltered}
                onClick={clearFilter}
              />
            )}

            <span className="invf-hint">
              Listeyi süzmek için yukarıdaki kartlardan birine dokunun.
            </span>

            {/* ------------------------- Ürün listesi ------------------------- */}
            <div className="invf-list-card" ref={listRef}>
              <div className="invf-toolbar">
                <div className="invf-toolbar-top">
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                      Ürünler
                    </span>
                    <span style={{ fontSize: 13, color: "#5C5C5C" }}>
                      {subtitleParts.join(" · ")}
                    </span>
                  </div>

                  <div className="invf-toolbar-actions">
                    {filteredRows.length > 0 && (
                      <button
                        type="button"
                        className="invf-export-btn"
                        onClick={handleExport}
                        title={`${filterContextLabel} · ${filteredRows.length} ürünü Excel'de açılabilen bir CSV dosyası olarak indirir.`}
                      >
                        {`Excel indir (${filteredRows.length})`}
                      </button>
                    )}
                    {isFiltered && (
                      <button type="button" className="invf-clear-btn" onClick={clearFilter}>
                        {`Tüm ürünleri göster (${allRows.length})`}
                      </button>
                    )}
                  </div>
                </div>

                <div className="invf-search">
                  <span className="invf-search-icon">🔍</span>
                  <input
                    type="search"
                    value={queryInput}
                    placeholder="Ürün adıyla ara"
                    aria-label="Ürün ara"
                    onChange={(e) => setQueryInput(e.target.value)}
                  />
                </div>
              </div>

              {pageRows.length > 0 && (
                <div className="invf-head">
                  <span>Ürün</span>
                  <span>Durum</span>
                  <span>Stok</span>
                  <span>Satış hızı</span>
                  <span>Ne zaman biter?</span>
                </div>
              )}

              {pageRows.map(({ item, category }) => {
                const meta = CATEGORY_META[category];

                let runway: ReactNode;
                if (category === "out") {
                  runway = (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#D72C0D" }}>
                      Stok bitti — hemen sipariş verin
                    </span>
                  );
                } else if (category === "soon" && item.stockoutInDays != null) {
                  runway = (
                    <RunwayCell
                      days={Math.round(item.stockoutInDays)}
                      confidence={String(item.confidence ?? "")}
                    />
                  );
                } else if (category === "dead") {
                  runway = (
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1F4C8C" }}>
                      Uzun süredir satılmıyor
                    </span>
                  );
                } else {
                  runway = (
                    <span className="invf-muted">Tahmin için yeterli satış geçmişi yok</span>
                  );
                }

                const showVariant = item.variantTitle && item.variantTitle !== "Default Title";
                const isOut = item.available <= 0;

                return (
                  <div
                    className="invf-row"
                    key={item.variantId}
                    style={{ borderLeft: `3px solid ${meta.accent}` }}
                  >
                    <div
                      className="invf-product"
                      style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          flexShrink: 0,
                          borderRadius: 9,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: meta.text,
                          background: meta.soft,
                        }}
                      >
                        {initials(item.productTitle)}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                          {item.productTitle}
                        </span>
                        {showVariant && (
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#6B6B6B" }}>
                            {item.variantTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="invf-c-status">
                      <CellLabel>Durum</CellLabel>
                      <StatusPill category={category} />
                    </div>

                    <div className="invf-c-stock">
                      <CellLabel>Stok</CellLabel>
                      <span className="invf-num" style={{ color: isOut ? "#D72C0D" : "#1A1A1A" }}>
                        {item.available}
                        <small>adet</small>
                      </span>
                    </div>

                    <div className="invf-c-rate">
                      <CellLabel>Satış hızı</CellLabel>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A1A1A" }}>
                        {rateText(item.dailyRate)}
                      </span>
                    </div>

                    <div className="invf-wide">
                      <CellLabel>Ne zaman biter?</CellLabel>
                      {runway}
                    </div>
                  </div>
                );
              })}

              {/* Boş durumun iki ayrı sebebi var, ikisi aynı metni göstermemeli. */}
              {filteredRows.length === 0 && allRows.length === 0 && (
                <div className="invf-empty">
                  <span style={{ fontSize: 26 }}>📦</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                    Gösterilecek ürün yok
                  </span>
                  <span style={{ fontSize: 13, color: "#5C5C5C", maxWidth: 380 }}>
                    Stok takibi açık bir ürün bulunamadı. Shopify'da ürünlerinizin stok takibinin
                    açık olduğundan emin olun, sonra verileri yenileyin.
                  </span>
                </div>
              )}

              {filteredRows.length === 0 && allRows.length > 0 && (
                <div className="invf-empty">
                  <span style={{ fontSize: 26 }}>🔍</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                    Bu süzgeçle eşleşen ürün yok
                  </span>
                  <span style={{ fontSize: 13, color: "#5C5C5C" }}>
                    Aramayı değiştirin ya da tüm ürünlere dönün.
                  </span>
                  <button
                    type="button"
                    className="invf-clear-btn"
                    style={{ marginTop: 6 }}
                    onClick={clearFilter}
                  >
                    {`Tüm ürünleri göster (${allRows.length})`}
                  </button>
                </div>
              )}

              {filteredRows.length > PAGE_SIZE && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "13px 18px",
                    borderTop: "1px solid #EBEBEB",
                  }}
                >
                  <button
                    type="button"
                    className="invf-pagebtn"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    ← Önceki
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>
                    {`Sayfa ${currentPage} / ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    className="invf-pagebtn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Sonraki →
                  </button>
                </div>
              )}

              {allRows.length > 0 && (
                <div className="invf-foot">
                  Satış hızı, son 7 / 30 / 90 günlük satışlarınızın ağırlıklı ortalamasıdır. Birim
                  ürünün hızına göre değişir: hızlı satanlarda günlük, yavaş satanlarda aylık
                  gösterilir.
                </div>
              )}
            </div>
          </div>
        </s-stack>
      </s-page>

      {/* s-page'in DIŞINDA render ediliyor ki position:fixed gerçekten
          tarayıcı penceresine göre sabitlensin (bir Polaris web bileşeni
          içeride transform kullanırsa fixed, viewport yerine ona göre
          sabitlenebilir). Bu yüzden hem "yukarı çık" hem "geri bildirim"
          butonu burada, s-page'e kardeş eleman olarak duruyor. */}

      {/* Geri bildirim: sol altta sabit/yüzen, sayfanın her yerinden
          scroll etmeden erişilebilir. Kendi konumunu ve stilini kendi
          bileşen dosyasında (FeedbackButton.tsx) taşıyor. */}
      <FeedbackButton />

      {showScrollTop && (
        <button
          type="button"
          className="invf-scrolltop-btn"
          style={scrollTopButtonStyle}
          onClick={scrollToTop}
          aria-label="Sayfanın başına dön"
          title="Yukarı çık"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5M12 5L6 11M12 5L18 11"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
