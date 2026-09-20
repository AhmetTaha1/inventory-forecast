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

// "Yukarı çık" / "geri bildirim" butonlarının viewport kenarına ne kadar
// yakın duracağı. 44px hem ölçüm tamamlanana kadarki yedek değer HEM DE
// düşülebilecek taban — kart viewport'a neredeyse tam yaslanmışsa (dar/orta
// genişlikte pencere) ölçülen boşluk çok küçük çıkar ve buton tablo
// metninin üzerine biner; bu yüzden asla 44px'in altına inmiyor. Sadece
// gerçekten geniş ekranlarda (kart etrafında bariz boş alan varsa) ölçülen
// daha büyük değere geçiliyor.
const FLOATING_BUTTON_DEFAULT_OFFSET = 44;
// Butonlar, ürün listesi kartının kenarından bu kadar dışarı taşıyor —
// tam kenara yapışık değil ama ona görünüşte "ait" duruyor.
const FLOATING_BUTTON_EDGE_GAP = 8;

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
  const [floatingOffsets, setFloatingOffsets] = useState({
    left: FLOATING_BUTTON_DEFAULT_OFFSET,
    right: FLOATING_BUTTON_DEFAULT_OFFSET,
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
  // göre ölçülüyor, hangi ekran genişliğinde olursa olsun içeriğe yakın kalır.
  useEffect(() => {
    function measure() {
      const rect = listRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFloatingOffsets({
        left: Math.max(FLOATING_BUTTON_DEFAULT_OFFSET, rect.left - FLOATING_BUTTON_EDGE_GAP),
        right: Math.max(FLOATING_BUTTON_DEFAULT_OFFSET, window.innerWidth - rect.right - FLOATING_BUTTON_EDGE_GAP),
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
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
    const rows = buildExportRows(filteredRows, t, locale, categoryMeta);
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
    // Aktif kaydırma sırasında soluklaşıp küçülüyor (bkz. yukarıdaki not).
    opacity: isScrolling ? 0.35 : 1,
    transform: isScrolling ? "scale(0.85)" : "scale(1)",
    pointerEvents: isScrolling ? "none" : "auto",
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
    isScrolling,
  };
}
