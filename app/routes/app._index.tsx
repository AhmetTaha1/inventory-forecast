import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useNavigation } from "react-router";
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

// ---------------------------------------------------------------------------
// Görsel ayarlar
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

type Category = "out" | "soon" | "dead" | "nodata";
type Filter = "all" | Category;

type CategoryMeta = {
  label: string;
  hint: string;
  accent: string;
  soft: string;
  text: string;
};

// Renkler Shopify admin'in critical / warning / info / neutral tonlarına yakın.
const CATEGORY_META: { [K in Category]: CategoryMeta } = {
  out: {
    label: "Tükendi",
    hint: "Hemen sipariş verin",
    accent: "#D72C0D",
    soft: "#FEE9E8",
    text: "#8E1F0B",
  },
  soon: {
    label: "Yakında tükenecek",
    hint: "Sipariş planlayın",
    accent: "#E8A317",
    soft: "#FFF4E0",
    text: "#7A5100",
  },
  dead: {
    label: "Ölü stok",
    hint: "Satılmayan, rafta bekleyen",
    accent: "#2C6ECB",
    soft: "#EAF4FF",
    text: "#1F4C8C",
  },
  nodata: {
    label: "Veri yetersiz",
    hint: "Satış verisi toplanıyor",
    accent: "#8A8A8A",
    soft: "#F1F1F1",
    text: "#4A4A4A",
  },
};

const CATEGORY_ORDER: Category[] = ["out", "soon", "dead", "nodata"];

// "Tümü" sekmesinin rengi (uygulamanın ana yeşili).
const ALL_META = { accent: "#008060", soft: "#E3F1DF", text: "#0C5132" };

// Liste satırlarının sütun düzeni: Ürün · Durum · Stok · Günlük satış · Tükenme · Güven
// Sütunlar arası boşluk artırıldı (gap 32px), sayı sütunlarına minimum genişlik verildi.
const GRID_COLUMNS = "minmax(240px, 2fr) 170px minmax(70px, 90px) minmax(110px, 130px) minmax(220px, 1.7fr) 110px";

const PAGE_CSS = `
@keyframes invf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.invf-list-card {
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
  overflow: hidden;
}
.invf-toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px 16px;
}
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
.invf-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.invf-tab {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: background 120ms ease, border-color 120ms ease;
}
.invf-tab:hover { filter: brightness(0.98); }

.invf-head, .invf-row {
  display: grid;
  grid-template-columns: ${GRID_COLUMNS};
  column-gap: 32px;
  row-gap: 0;
  align-items: center;
  padding: 18px 24px;
}
.invf-head {
  background: #F7F7F7;
  border-top: 1px solid #EBEBEB;
  border-bottom: 1px solid #EBEBEB;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #303030;
  padding-top: 12px;
  padding-bottom: 12px;
}
.invf-row {
  border-bottom: 1px solid #F0F0F0;
  transition: background 120ms ease;
}
.invf-row:last-child { border-bottom: none; }
.invf-row:hover { background: #FAFBFB; }
.invf-right { text-align: right; }
.invf-label { display: none; }

.invf-days-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 800;
}
.invf-days-chip small { font-size: 11px; font-weight: 700; }

.invf-date-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: #616161;
}

.invf-bar {
  height: 6px;
  border-radius: 999px;
  background: #EEEEEE;
  overflow: hidden;
  margin-top: 10px;
  max-width: 220px;
}
.invf-bar > span { display: block; height: 100%; border-radius: 999px; }

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

@media (max-width: 900px) {
  .invf-head { display: none; }
  .invf-row { grid-template-columns: 1fr 1fr; row-gap: 16px; column-gap: 20px; }
  .invf-product { grid-column: 1 / -1; }
  .invf-wide { grid-column: 1 / -1; }
  .invf-right { text-align: left; }
  .invf-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #616161;
    margin-bottom: 4px;
  }
}
`;

// Yenileme sırasında içeriğin soluklaşması.
function dimStyle(dimmed: boolean): CSSProperties {
  return {
    opacity: dimmed ? 0.45 : 1,
    transition: "opacity 150ms ease",
    pointerEvents: dimmed ? "none" : "auto",
  };
}

// Ürün adından avatar için baş harfler ("The" gibi kelimeler atlanır).
function initials(title: string): string {
  const words = title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["the", "a", "an"].includes(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
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

  const style: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "16px 16px 14px",
    borderRadius: 12,
    background: props.active ? meta.soft : "#FFFFFF",
    border: props.active ? `2px solid ${meta.accent}` : "1px solid #E3E3E3",
    borderTop: `4px solid ${meta.accent}`,
    boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
    fontFamily: "inherit",
    minWidth: 0,
  };

  return (
    <button type="button" style={style} onClick={props.onClick} aria-pressed={props.active}>
      <span style={{ fontSize: 13, fontWeight: 600, color: meta.text }}>{meta.label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: "#1A1A1A" }}>
        {props.count}
      </span>
      <span style={{ fontSize: 12, color: "#4A4A4A" }}>{meta.hint}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filtre sekmesi
// ---------------------------------------------------------------------------

type FilterTabProps = {
  label: string;
  count: number;
  active: boolean;
  accent: string;
  soft: string;
  text: string;
  onClick: () => void;
};

function FilterTab(props: FilterTabProps) {
  const style: CSSProperties = {
    color: props.active ? props.text : "#303030",
    background: props.active ? props.soft : "#FFFFFF",
    border: props.active ? `1.5px solid ${props.accent}` : "1px solid #E3E3E3",
  };

  const countStyle: CSSProperties = {
    minWidth: 18,
    textAlign: "center",
    padding: "1px 7px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: props.active ? "#FFFFFF" : props.text,
    background: props.active ? props.accent : props.soft,
  };

  return (
    <button
      type="button"
      className="invf-tab"
      style={style}
      onClick={props.onClick}
      aria-pressed={props.active}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: props.accent, flexShrink: 0 }}
      />
      {props.label}
      <span style={countStyle}>{props.count}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Üst şerit: büyük yenile butonu + son güncelleme bilgisi
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
    boxShadow: "0 2px 6px rgba(0, 128, 96, 0.35)",
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
        padding: "14px 16px",
        borderRadius: 12,
        background: "#FFFFFF",
        border: "1px solid #E3E3E3",
      }}
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: 2, ...dimStyle(props.isRefreshing) }}
      >
        <span style={{ fontSize: 13, color: "#4A4A4A" }}>Son güncelleme</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>
          {props.lastUpdated}
          {props.justRefreshed && !props.isRefreshing && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: "#008060" }}>
              ✓ Az önce güncellendi
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
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
// Liste yardımcıları
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
        fontSize: 12,
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

function ConfidencePill(props: { value: string }) {
  let label = "";
  let color = "";
  let bg = "";
  if (props.value === "low") {
    label = "Düşük";
    color = "#7A5100";
    bg = "#FFF4E0";
  } else if (props.value === "medium") {
    label = "Orta";
    color = "#1F4C8C";
    bg = "#EAF4FF";
  } else if (props.value === "high") {
    label = "Yüksek";
    color = "#0C5132";
    bg = "#E3F1DF";
  }
  if (!label) return null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg,
      }}
    >
      {label}
    </span>
  );
}

function CellLabel(props: { children: ReactNode }) {
  return <span className="invf-label">{props.children}</span>;
}

// Tükenme hücresi: "kaç gün kaldığı" ile "hangi tarihte tükeneceği" görsel
// olarak ayrıştırıldı — biri dolgulu rozet (kalın), diğeri ayrı satırda,
// takvim ikonlu, daha soluk metin. İkisi artık yan yana karışmıyor.
function RunwayCell(props: { days: number }) {
  const { days } = props;
  const bg = days <= 7 ? "#FEE9E8" : days <= 21 ? "#FFF4E0" : "#E3F1DF";
  const fg = days <= 7 ? "#C4210B" : days <= 21 ? "#8A5A00" : "#0C5132";
  const barColor = days <= 7 ? "#D72C0D" : days <= 21 ? "#E8A317" : "#008060";
  const pct = Math.max(6, Math.min(100, (days / 60) * 100));
  const date = new Date(Date.now() + days * 86_400_000).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <span className="invf-days-chip" style={{ background: bg, color: fg }}>
        {days}
        <small>GÜN</small>
      </span>
      <div className="invf-date-row">
        <span>📅</span>
        <span>{`${date}'e kadar`}</span>
      </div>
      <div className="invf-bar">
        <span style={{ width: `${pct}%`, background: barColor }} />
      </div>
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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const refresh = () => navigate("?refresh=1");

  // Dört grubu tek listede birleştir. Sıra: en acil olan en üstte.
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
      if (filter !== "all" && category !== filter) return false;
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

  const lastUpdated = new Date(computedAt).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <s-page heading="Envanter Tahmini">
      <style>{PAGE_CSS}</style>

      <s-stack gap="base">
        <RefreshBar
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          justRefreshed={!fromCache}
          onRefresh={refresh}
        />

        {/* Yenileme sırasında buton dışındaki her şey birlikte soluklaşır. */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: 16, ...dimStyle(isRefreshing) }}
        >
          {reorderAlerts.length > 0 && (
            <s-banner
              heading={`${reorderAlerts.length} ürün için sipariş vakti geldi`}
              tone={outOfStock.length > 0 ? "critical" : "warning"}
            >
              <s-stack gap="small-300">
                <s-text>
                  {reorderAlerts
                    .slice(0, 3)
                    .map((f) => f.productTitle)
                    .join(", ")}
                  {reorderAlerts.length > 3 ? ` ve ${reorderAlerts.length - 3} ürün daha.` : "."}
                </s-text>
                <s-text>Tükenmiş ya da 14 gün içinde tükenmesi beklenen ürünler.</s-text>
              </s-stack>
            </s-banner>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
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

          {/* ------------------------- Ürün listesi ------------------------- */}
          <div className="invf-list-card">
            <div className="invf-toolbar">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                  Ürün listesi
                </span>
                <span style={{ fontSize: 13, color: "#4A4A4A" }}>
                  En acil olanlar en üstte · {filteredRows.length} ürün gösteriliyor
                </span>
              </div>

              <div className="invf-search">
                <span className="invf-search-icon">🔍</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Ürün ya da varyant adıyla ara"
                  aria-label="Ürün ara"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="invf-tabs">
                <FilterTab
                  label="Tümü"
                  count={allRows.length}
                  active={filter === "all"}
                  accent={ALL_META.accent}
                  soft={ALL_META.soft}
                  text={ALL_META.text}
                  onClick={() => {
                    setFilter("all");
                    setPage(1);
                  }}
                />
                {CATEGORY_ORDER.map((cat) => (
                  <FilterTab
                    key={cat}
                    label={CATEGORY_META[cat].label}
                    count={counts[cat]}
                    active={filter === cat}
                    accent={CATEGORY_META[cat].accent}
                    soft={CATEGORY_META[cat].soft}
                    text={CATEGORY_META[cat].text}
                    onClick={() => changeFilter(cat)}
                  />
                ))}
              </div>
            </div>

            <div className="invf-head">
              <span>Ürün</span>
              <span>Durum</span>
              <span className="invf-right">Stok</span>
              <span className="invf-right">Günlük satış</span>
              <span>Tükenme</span>
              <span>Güven</span>
            </div>

            {pageRows.map(({ item, category }) => {
              const meta = CATEGORY_META[category];

              let runway: ReactNode;
              if (category === "out") {
                runway = (
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#D72C0D" }}>
                    Hemen sipariş verin
                  </span>
                );
              } else if (category === "soon" && item.stockoutInDays != null) {
                runway = <RunwayCell days={Math.round(item.stockoutInDays)} />;
              } else if (category === "dead") {
                runway = (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1F4C8C" }}>
                    Son dönemde satış yok
                  </span>
                );
              } else {
                runway = (
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#4A4A4A" }}>
                    Tahmin için veri toplanıyor
                  </span>
                );
              }

              const showVariant = item.variantTitle && item.variantTitle !== "Default Title";

              return (
                <div className="invf-row" key={item.variantId}>
                  <div
                    className="invf-product"
                    style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        flexShrink: 0,
                        borderRadius: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: meta.text,
                        background: meta.soft,
                      }}
                    >
                      {initials(item.productTitle)}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                        {item.productTitle}
                      </span>
                      {showVariant && (
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#616161" }}>
                          {item.variantTitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <CellLabel>Durum</CellLabel>
                    <StatusPill category={category} />
                  </div>

                  <div className="invf-right">
                    <CellLabel>Stok</CellLabel>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: item.available <= 0 ? "#D72C0D" : "#1A1A1A",
                      }}
                    >
                      {item.available}
                    </span>
                  </div>

                  <div className="invf-right">
                    <CellLabel>Günlük satış</CellLabel>
                    {item.dailyRate != null && (
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                        {item.dailyRate.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="invf-wide">
                    <CellLabel>Tükenme</CellLabel>
                    {runway}
                  </div>

                  <div>
                    {category === "soon" && (
                      <>
                        <CellLabel>Güven</CellLabel>
                        <ConfidencePill value={String(item.confidence ?? "")} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredRows.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "40px 20px",
                  borderTop: "1px solid #EBEBEB",
                }}
              >
                <span style={{ fontSize: 28 }}>🔍</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>
                  Sonuç bulunamadı
                </span>
                <span style={{ fontSize: 13, color: "#4A4A4A" }}>
                  Arama ifadesini ya da seçili filtreyi değiştirmeyi deneyin.
                </span>
              </div>
            )}

            {filteredRows.length > PAGE_SIZE && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 20px",
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
          </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};