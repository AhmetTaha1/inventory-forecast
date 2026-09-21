import * as XLSX from "xlsx";
import type { Locale, Dictionary } from "../translations";
import type { Category, CategoryMetaMap, Filter } from "../../types/inventory";
import { confidenceText, rateText, stockoutDateText } from "./format";

// ---------------------------------------------------------------------------
// Excel (.xlsx) dışa aktarma
// ---------------------------------------------------------------------------
// Buton her zaman "o an ekranda görünen (süzülmüş/aranmış) liste"yi indirir.
// Kategori başına ayrı buton yok — kart tıklayıp süzgeci değiştirmek zaten
// aynı işi görüyor, buton sadece aktif süzgece göre neyi indireceğine karar
// veriyor. Sayfalama sadece görünümü etkiler; export her zaman süzülmüş
// KÜMENİN TAMAMINI indirir (sadece o an açık olan 25 satırı değil).
//
// ÖNEMLİ (v11 sonrası karar değişikliği): Başlangıçta bu, "Excel'de
// açılabilen CSV" idi (gerçek .xlsx değil) — basit ve bağımlılıksız
// olduğu için bilinçli bir tercihti. Ancak mobil cihazlardaki genel
// dosya görüntüleyiciler CSV'nin virgülle ayrıldığını her zaman doğru
// algılayamıyor (tüm satırı tek hücreye tıkıştırabiliyor) — bu da
// "bozuk" bir çıktı izlenimi veriyordu. Kalıcı çözüm: SheetJS (`xlsx`
// paketi) ile GERÇEK bir .xlsx dosyası üretmek. Bu, herhangi bir
// virgül/locale belirsizliği taşımıyor — Excel, Google Sheets, telefon
// görüntüleyicisi, ne açarsa açsın sütunlar her zaman doğru ayrılmış
// geliyor. `npm install xlsx` ile eklendi.

export function slugifyFilterName(filter: Filter, t: Dictionary, categoryMeta: CategoryMetaMap): string {
  if (filter === "all") return t.filenameAllProducts;
  if (filter === "urgent") return t.filenameUrgentProducts;
  if (filter === "snoozed") return t.filenameSnoozedProducts;
  // Dosya adı ASCII olmalı — hem Türkçe hem İngilizce etiketler için
  // aynı normalize zinciri çalışıyor (İngilizce'de zaten aksan yok).
  return categoryMeta[filter].label
    .toLocaleLowerCase("en-US")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// item burada bilinçli olarak `any`: loader'ın döndürdüğü satır tipi bu
// dosyada zaten hiçbir yerde katı biçimde tanımlanmamış (RunwayCell'deki
// `String(item.confidence ?? "")` kullanımıyla aynı yaklaşım).
// Fonksiyon adı "Csv" ile başlıyor ama artık xlsx için de kullanılıyor —
// isim tarihsel, davranış (bitiş metnini üretmek) format'tan bağımsız.
function runwayCsvText(item: any, category: Category, t: Dictionary, locale: Locale): string {
  if (category === "out") return t.csvOut;
  if (category === "dead") return t.csvDead;
  if (category === "nodata") return t.csvNoDataRunway;
  const days = item.stockoutInDays;
  if (days == null) return t.csvDash;
  const rounded = Math.round(days);
  if (rounded <= 0) return t.csvToday;
  return t.csvDaysLater(rounded, stockoutDateText(rounded, locale));
}

// Sözlükteki `csvHeaders`/`csvOut` gibi alan adları tarihsel (bkz. yukarı) —
// bu satırlar artık .xlsx dosyasının satırları, gerçek CSV metni değil.
// includeReorderQty: sipariş ayarları (tedarik süresi) hiç yapılmamışsa
// false — bu durumda "Önerilen sipariş" sütunu hiç eklenmiyor, ayarlanmamış
// varsayılan değerlere göre üretilmiş bir öneri sessizce dışa aktarılmasın.
export function buildExportRows(
  rows: Array<{ item: any; category: Category }>,
  t: Dictionary,
  locale: Locale,
  categoryMeta: CategoryMetaMap,
  includeReorderQty: boolean,
): (string | number)[][] {
  const headers = includeReorderQty ? [...t.csvHeaders, t.csvReorderQtyHeader] : t.csvHeaders;
  const data: (string | number)[][] = [headers];

  for (const { item, category } of rows) {
    const note = category === "soon" ? confidenceText(String(item.confidence ?? ""), t) ?? "" : "";
    const row: (string | number)[] = [
      item.productTitle ?? "",
      item.variantTitle && item.variantTitle !== "Default Title" ? item.variantTitle : "",
      categoryMeta[category].label,
      item.available ?? "",
      rateText(item.dailyRate, t),
      runwayCsvText(item, category, t, locale),
      note,
    ];
    if (includeReorderQty) {
      const qty = item.suggestedReorderQty;
      row.push(typeof qty === "number" && qty > 0 ? qty : "");
    }
    data.push(row);
  }

  return data;
}

// Sütun genişlikleri sabit — "Ürün" ve "Not" en uzun içerikli sütunlar
// olduğu için biraz daha geniş, "Stok" tek haneli/iki haneli sayılar
// içerdiği için dar. Sıra buildExportRows'taki sütun sırasıyla birebir
// eşleşmeli. Son sütun ("Önerilen sipariş") includeReorderQty'ye göre
// koşullu olduğu için ayrı ekleniyor.
const EXPORT_COLUMN_WIDTHS = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 28 }, { wch: 32 }];
const EXPORT_REORDER_QTY_COLUMN_WIDTH = { wch: 16 };

export function downloadXlsx(rows: (string | number)[][], fileName: string) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  // Başlık satırındaki gerçek sütun sayısına göre genişlik uygulanıyor —
  // "Önerilen sipariş" sütunu koşullu olduğu için sabit bir uzunluk varsaymıyoruz.
  const columnCount = rows[0]?.length ?? EXPORT_COLUMN_WIDTHS.length;
  worksheet["!cols"] =
    columnCount > EXPORT_COLUMN_WIDTHS.length
      ? [...EXPORT_COLUMN_WIDTHS, EXPORT_REORDER_QTY_COLUMN_WIDTH]
      : EXPORT_COLUMN_WIDTHS;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  XLSX.writeFile(workbook, fileName);
}
