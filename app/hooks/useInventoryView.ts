import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useNavigation } from "react-router";
import { intlLocale, type Dictionary, type Locale } from "../lib/translations";
import { buildExportRows, downloadXlsx, slugifyFilterName } from "../lib/inventory/export";
import {
  PAGE_SIZE,
  SCROLL_IDLE_DELAY_MS,
  SCROLL_TOP_THRESHOLD,
  SEARCH_DEBOUNCE_MS,
  URGENT_DAYS,
} from "../lib/inventory/constants";
import type { Category, CategoryMetaMap, Filter } from "../types/inventory";

// "Yukarı çık" / "geri bildirim" butonlarının konumlanma mantığı:
// - Kartın etrafında butonu TAMAMEN dışarı, içerikle çakışmadan
//   yerleştirecek kadar boşluk varsa (bkz. measure()), oraya yerleştirilir.
// - Yoksa (dar/orta genişlikte pencere, mobil) eski, içerikle üst üste
//   gelebilen ama aktif kaydırmada soluklaşan (bkz. isScrolling) güvenli
//   konuma düşülür — bu yüzden 44 hem yedek hem de "sıkışık" taban değer.
const FLOATING_BUTTON_DEFAULT_OFFSET = 44;
// Butonlar, ürün listesi kartının kenarından bu kadar dışarı taşıyor —
// tam kenara yapışık değil ama ona görünüşte "ait" duruyor.
const FLOATING_BUTTON_EDGE_GAP = 8;
// "Yukarı çık" her zaman 48x48 dairesel — sağ tarafta Shopify'ın kendi
// arayüzünden (nav menüsü sadece SOLDA var) hiçbir risk yok, bu yüzden eşik
// düşük tutulabilir: az bir boşluk bile "dışarı" yerleştirmek için yeterli.
const SCROLL_TOP_BUTTON_SIZE = 48;
const RIGHT_OUTSIDE_MIN_MARGIN = SCROLL_TOP_BUTTON_SIZE + FLOATING_BUTTON_EDGE_GAP + FLOATING_BUTTON_DEFAULT_OFFSET;
// Geri bildirim butonunun pil genişliği metne göre değişiyor (tr/en), tam
// ölçüm yerine güvenli bir üst sınır kullanılıyor. SOLDA Shopify'ın kendi
// nav menüsü olduğu için eşik bilerek çok daha yüksek: dar/orta genişlikte
// "boşluk" aslında menüyle içerik arasındaki dar pay olabilir, oraya
// yerleştirmek butonu Shopify'ın kendi menüsünün üzerine bindirebilirdi.
const FEEDBACK_BUTTON_ESTIMATED_WIDTH = 200;
const LEFT_OUTSIDE_MIN_MARGIN = FEEDBACK_BUTTON_ESTIMATED_WIDTH + FLOATING_BUTTON_EDGE_GAP + 400;

type InventoryItem = any;

type UseInventoryViewArgs = {
  outOfStock: InventoryItem[];
  soonToStockout: InventoryItem[];
  deadStock: InventoryItem[];
  insufficientData: InventoryItem[];
  reorderAlerts: InventoryItem[];
  computedAt: string;
  locale: Locale;
  t: Dictionary;
  categoryMeta: CategoryMetaMap;
  hasReorderSettings: boolean;
};

// Sayfanın tüm state/filtre/sayfalama/export mantığı burada toplanıyor —
// app._index.tsx sadece bu hook'un döndürdüğü değerleri render eder.
export function useInventoryView({
  outOfStock,
  soonToStockout,
  deadStock,
  insufficientData,
  reorderAlerts,
  computedAt,
  locale,
  t,
  categoryMeta,
  hasReorderSettings,
}: UseInventoryViewArgs) {
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
  const [isScrolling, setIsScrolling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // "Cramped" (sıkışık): butonu içeriğin tamamen dışına, çakışmadan
  // koyacak kadar boşluk yok demek — bu durumda eski, kaydırmada
  // soluklaşan güvenli davranışa dönülüyor (bkz. isScrolling kullanımı).
  const [floatingOffsets, setFloatingOffsets] = useState({
    left: FLOATING_BUTTON_DEFAULT_OFFSET,
    right: FLOATING_BUTTON_DEFAULT_OFFSET,
    leftCramped: true,
    rightCramped: true,
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [queryInput]);

  // Belli bir miktar aşağı kaydırılınca "yukarı çık" butonu beliriyor.
  // Ayrıca: floating butonlar (bkz. render) aktif kaydırma sırasında
  // soluklaşıp küçülüyor, kaydırma bittikten SCROLL_IDLE_DELAY_MS sonra
  // normale dönüyor — kayan bir liste satırının metnini tamamen kapatmasın
  // diye. Kaydırırken zaten o satırı okumuyorsun; durduğunda çoğunlukla
  // buton farklı bir satırın hizasında oluyor.
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    function handleScroll() {
      setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD);
      setIsScrolling(true);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsScrolling(false), SCROLL_IDLE_DELAY_MS);
    }
    // İlk konum kontrolü — sayfa yüklendiğinde zaten kaydırılmış olabilir
    // (örn. geri tuşu). "isScrolling"i tetiklemiyor, sadece görünürlüğü.
    setShowScrollTop(window.scrollY > SCROLL_TOP_THRESHOLD);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(idleTimer);
    };
  }, []);

  // "Yukarı çık" / "geri bildirim" butonları önceden viewport kenarına sabit
  // 44px'ten konumlanıyordu — geniş (ör. 27") ekranlarda Shopify admin
  // içeriği ortada dar bir sütunda kalırken butonlar ekranın en uçlarında,
  // içerikten kopuk duruyordu. Artık ürün listesi kartının GERÇEK kenarına
  // göre ölçülüyor: yeterince boşluk varsa butonlar içeriğin TAMAMEN
  // dışına (çakışmadan) yerleştiriliyor; yoksa eski, kaydırmada soluklaşan
  // güvenli konuma düşülüyor (bkz. "cramped").
  useEffect(() => {
    function measure() {
      const rect = listRef.current?.getBoundingClientRect();
      if (!rect) return;

      const marginLeft = rect.left;
      const marginRight = window.innerWidth - rect.right;
      const rightCramped = marginRight < RIGHT_OUTSIDE_MIN_MARGIN;
      const leftCramped = marginLeft < LEFT_OUTSIDE_MIN_MARGIN;

      setFloatingOffsets({
        left: leftCramped
          ? FLOATING_BUTTON_DEFAULT_OFFSET
          : marginLeft - FEEDBACK_BUTTON_ESTIMATED_WIDTH - FLOATING_BUTTON_EDGE_GAP,
        right: rightCramped
          ? FLOATING_BUTTON_DEFAULT_OFFSET
          : marginRight - SCROLL_TOP_BUTTON_SIZE - FLOATING_BUTTON_EDGE_GAP,
        leftCramped,
        rightCramped,
      });
    }
    measure();
    // Shopify'ın kendi web bileşenleri (<s-page> vb.) mount anında henüz
    // tam yerleşmemiş olabilir — ilk ölçüm bu yüzden yanlış (dar) bir
    // boşluk hesaplayıp butonu gereğinden fazla "sıkışık" işaretleyebilir,
    // sonrasında pencere yeniden boyutlandırılmadan düzelmez. Layout
    // oturduktan sonra bir kez daha ölçüyoruz.
    const settleTimer = setTimeout(measure, 400);
    // ResizeObserver, kartın GENİŞLİĞİ (dolayısıyla konumu) değiştiğinde
    // tetikleniyor — nav menüsü açılıp kapandığında ya da Shopify admin
    // kendi iç düzenini değiştirdiğinde de (pencere boyutu aynı kalsa
    // bile) yeniden ölçüm yapılmasını sağlıyor.
    const observer = listRef.current ? new ResizeObserver(measure) : null;
    if (listRef.current && observer) observer.observe(listRef.current);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(settleTimer);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
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
    const q = query.trim().toLocaleLowerCase(intlLocale(locale));
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
      const haystack = `${item.productTitle} ${item.variantTitle}`.toLocaleLowerCase(intlLocale(locale));
      return haystack.includes(q);
    });
  }, [allRows, filter, query, locale]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Kart/filtre değişince listeye otomatik kayıyor — mobilde özet kartları +
  // uyarı kutusu sayfanın büyük kısmını kapladığı için, önceden sadece
  // "Acil ürünleri göster" butonunda olan bu davranış artık TÜM filtre
  // değişikliklerinde geçerli (kategori kartına dokunmak da dahil).
  function scrollToList() {
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function changeFilter(next: Filter) {
    setFilter((prev) => (prev === next ? "all" : next));
    setPage(1);
    scrollToList();
  }

  function clearFilter() {
    setFilter("all");
    setQueryInput("");
    setQuery("");
    setPage(1);
    scrollToList();
  }

  function showUrgent() {
    setFilter("urgent");
    setQueryInput("");
    setQuery("");
    setPage(1);
    scrollToList();
  }

  function handleExport() {
    const rows = buildExportRows(filteredRows, t, locale, categoryMeta, hasReorderSettings);
    const label = slugifyFilterName(filter, t, categoryMeta);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadXlsx(rows, `${t.filenamePrefix}-${label}-${dateStr}.xlsx`);
  }

  const lastUpdated = new Date(computedAt).toLocaleString(intlLocale(locale), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ---- Uyarı kutusu metni --------------------------------------------------
  const urgentSoonCount = Math.max(0, reorderAlerts.length - outOfStock.length);
  const alertParts: string[] = [];
  if (outOfStock.length > 0) {
    alertParts.push(t.outOfStockPart(outOfStock.length));
  }
  if (urgentSoonCount > 0) {
    alertParts.push(t.soonPart(urgentSoonCount, URGENT_DAYS));
  }
  const alertDescription = alertParts.length > 0 ? `${alertParts.join(", ")}.` : undefined;

  // ---- Süzgeç durumu -------------------------------------------------------
  const trimmedQuery = query.trim();
  const activeFilterLabel =
    filter === "all" ? null : filter === "urgent" ? t.urgentFilterLabel : categoryMeta[filter].label;
  const isFiltered = activeFilterLabel !== null || trimmedQuery.length > 0;

  const subtitleParts: string[] = [];
  if (isFiltered) {
    subtitleParts.push(t.subtitleFilteredCount(allRows.length, filteredRows.length));
    if (activeFilterLabel) subtitleParts.push(t.subtitleFilterPrefix(activeFilterLabel));
    if (trimmedQuery) subtitleParts.push(t.subtitleSearchPrefix(trimmedQuery));
  } else {
    subtitleParts.push(t.subtitleAllCount(allRows.length));
    if (allRows.length > 0) subtitleParts.push(t.subtitleSortHint);
  }

  // Excel indir butonunun tooltip'inde ne indirdiğini söylemesi için
  // (buton metninde değil — hemen üstteki subtitle'da zaten yazıyor).
  const filterContextLabel = (() => {
    const parts: string[] = [];
    if (activeFilterLabel) parts.push(activeFilterLabel);
    if (trimmedQuery) parts.push(`"${trimmedQuery}"`);
    return parts.length > 0 ? parts.join(" · ") : t.allProductsTitle;
  })();

  // Sağdan boşluk artık ürün listesi kartının gerçek kenarına göre ölçülüyor
  // (bkz. yukarıdaki floatingOffsets effect'i) — hâlâ sabit (fixed) ama
  // geniş ekranlarda içerikten kopup ekranın en ucuna yapışmıyor.
  const scrollTopButtonStyle: CSSProperties = {
    all: "unset",
    boxSizing: "border-box",
    position: "fixed",
    bottom: 32,
    right: floatingOffsets.right,
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
    // "Cramped" durumda (içeriğin dışına sığmıyorsa, ör. mobil) buton
    // DURGUNKEN bile hafif saydam kalıyor — kullanıcı kaydırmayı durdurup
    // tam o satırı okumak isteyebilir, tam opak bir buton bunu tamamen
    // engellerdi. Aktif kaydırma sırasında ekstra soluklaşıp küçülüyor.
    // Dışarı yerleşebildiğinde (cramped değilse) hiçbir satırın üzerine
    // gelmediği için tamamen opak kalıyor.
    opacity: !floatingOffsets.rightCramped ? 1 : isScrolling ? 0.3 : 0.55,
    transform: isScrolling && floatingOffsets.rightCramped ? "scale(0.85)" : "scale(1)",
    pointerEvents: isScrolling && floatingOffsets.rightCramped ? "none" : "auto",
  };

  return {
    isRefreshing,
    filter,
    queryInput,
    setQueryInput,
    showScrollTop,
    listRef,
    scrollToTop,
    refresh,
    allRows,
    counts,
    filteredRows,
    totalPages,
    currentPage,
    pageRows,
    setPage,
    changeFilter,
    clearFilter,
    showUrgent,
    handleExport,
    lastUpdated,
    alertDescription,
    activeFilterLabel,
    isFiltered,
    subtitleParts,
    filterContextLabel,
    scrollTopButtonStyle,
    feedbackLeftOffset: floatingOffsets.left,
    feedbackIsCramped: floatingOffsets.leftCramped,
    isScrolling,
  };
}
