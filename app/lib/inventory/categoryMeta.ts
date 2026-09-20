import type { Dictionary } from "../translations";
import type { CategoryMetaMap } from "../../types/inventory";

// Kategori renkleri dilden bağımsız (accent/soft/text) — sadece label/hint
// dile göre değişiyor. Bu yüzden sabit bir obje yerine, aktif sözlüğü (t)
// alan bir fonksiyon: component her render'da kendi dilindeki metinlerle
// çağırıyor (bkz. Index() içindeki `categoryMeta`).
export function buildCategoryMeta(t: Dictionary): CategoryMetaMap {
  return {
    out: {
      label: t.categoryOutLabel,
      hint: t.categoryOutHint,
      accent: "#D72C0D",
      soft: "#FEE9E8",
      text: "#8E1F0B",
    },
    soon: {
      label: t.categorySoonLabel,
      hint: t.categorySoonHint,
      accent: "#E8A317",
      soft: "#FFF4E0",
      text: "#7A5100",
    },
    dead: {
      label: t.categoryDeadLabel,
      hint: t.categoryDeadHint,
      accent: "#2C6ECB",
      soft: "#EAF4FF",
      text: "#1F4C8C",
    },
    nodata: {
      label: t.categoryNoDataLabel,
      hint: t.categoryNoDataHint,
      accent: "#8A8A8A",
      soft: "#F1F1F1",
      text: "#4A4A4A",
    },
  };
}
