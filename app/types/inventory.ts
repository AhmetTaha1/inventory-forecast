// "healthy" (YENİ): önceden "soon" grubu, tahmin edilebilen TÜM ürünleri
// içeriyordu — stoğu 6 ay yetecek bir ürün bile "Azalıyor / Yakında sipariş
// verin" kartında sayılıyordu. Gerçek mağazada 203 ürün "azalıyor"
// görünürken bunların sadece 6'sının siparişi gerçekten gelmişti; üstteki
// uyarı kutusu "27 ürün" derken hemen altındaki kart "203" diyordu.
// Artık "soon" SADECE sipariş noktasına gelmiş/yaklaşmış ürünler, rahat
// stoklu olanlar "healthy".
export type Category = "out" | "soon" | "healthy" | "dead" | "nodata";
// "topSellers" bilerek Category DEĞİL — kategoriler birbirini dışlıyor
// (bir ürün ya "out" ya "soon" ya...), ama en çok satan bir ürün AYNI ANDA
// "soon" (hızlı satıp azalıyor) da olabilir. Çapraz, kategorilerden bağımsız
// bir filtre (bkz. forecastCache.server.ts: topSellers).
export type Filter = "all" | "urgent" | "snoozed" | "topSellers" | Category;

export type CategoryMeta = {
  label: string;
  hint: string;
  accent: string;
  soft: string;
  text: string;
};

export type CategoryMetaMap = { [K in Category]: CategoryMeta };

export type AlertTone = "critical" | "warning" | "success" | "info";
