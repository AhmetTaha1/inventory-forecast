import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../../lib/translations";

// ---------------------------------------------------------------------------
// Akıllı export preset'leri (bkz. ifh_competitor_ideas memory): tek bir
// "o an görünen listeyi indir" butonu yerine, ana buton eski davranışı
// (o an filtrelenmiş görünüm) korurken yanındaki ok butonu iki ek preset
// açıyor — "Tüm ürünler" ve "Bugün sipariş edilecekler". Mevcut kullanıcı
// alışkanlığı (tek tık = filtrelenmiş görünüm) bilerek BOZULMUYOR, yeni
// seçenekler saf bir ek.
// ---------------------------------------------------------------------------

type ExportMenuProps = {
  onExport: (preset: "filtered" | "all" | "reorderToday") => void;
  filteredCount: number;
  allCount: number;
  reorderTodayCount: number;
  filterContextLabel: string;
  // Hiçbir filtre/arama aktif değilken "Şu an görünen" ile "Tüm ürünler"
  // TAM OLARAK AYNI şey (ikisi de tüm katalog) — kullanıcı geri bildirimi:
  // menüde iki satırın da aynı sayıyı göstermesi kafa karıştırıyordu ("ikisi
  // de 249, ne farkı var?"). Filtre yokken "Şu an görünen" satırını menüden
  // TAMAMEN kaldırıyoruz — sadece gerçekten FARKLI bir şey ifade ettiğinde
  // (bir filtre/arama aktifken) gösteriliyor.
  isFiltered: boolean;
  t: Dictionary;
};

export function ExportMenu({ onExport, filteredCount, allCount, reorderTodayCount, filterContextLabel, isFiltered, t }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (filteredCount === 0 && allCount === 0) return null;

  return (
    <div className="invf-export-wrap" ref={wrapRef}>
      <button
        type="button"
        className="invf-export-btn"
        onClick={() => onExport("filtered")}
        title={t.excelTooltip(filterContextLabel, filteredCount)}
      >
        {t.excelButton(filteredCount)}
      </button>
      <button
        type="button"
        className="invf-export-caret"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.exportMenuCaretAriaLabel}
        aria-expanded={open}
      >
        ▾
      </button>
      {open && (
        <div className="invf-export-menu" role="menu">
          {isFiltered && (
            <button
              type="button"
              className="invf-export-menu-item"
              role="menuitem"
              onClick={() => {
                onExport("filtered");
                setOpen(false);
              }}
            >
              {/* Genel "Şu an görünen" yerine filtrenin ADINI ("Running low",
                  "\"kırmızı\"" gibi) doğrudan gösteriyoruz — daha net. */}
              {filterContextLabel}
              <span className="invf-export-menu-count">{filteredCount}</span>
            </button>
          )}
          <button
            type="button"
            className="invf-export-menu-item"
            role="menuitem"
            onClick={() => {
              onExport("all");
              setOpen(false);
            }}
          >
            {t.exportMenuAllLabel}
            <span className="invf-export-menu-count">{allCount}</span>
          </button>
          {reorderTodayCount > 0 && (
            <button
              type="button"
              className="invf-export-menu-item"
              role="menuitem"
              onClick={() => {
                onExport("reorderToday");
                setOpen(false);
              }}
            >
              {t.exportMenuReorderTodayLabel}
              <span className="invf-export-menu-count">{reorderTodayCount}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
