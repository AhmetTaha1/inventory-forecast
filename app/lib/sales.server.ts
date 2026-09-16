// app/lib/sales.server.ts
// Adım 4: veri boru hattı. Adım 5'te üç değişiklik eklendi (aşağıda işaretli):
//   1) isGiftCard alanı
//   2) Mağaza saat dilimine göre gün hesaplama (UTC yerine)
//   3) logSnapshot lokasyon toplama bug fix

type Admin = {
    graphql: (
        query: string,
        options?: { variables?: Record<string, unknown> },
    ) => Promise<{ json: () => Promise<any> }>;
};

export type VariantInfo = {
    variantId: string;
    variantTitle: string;
    productId: string;
    productTitle: string;
    status: string; // ACTIVE | DRAFT | ARCHIVED
    tracked: boolean;
    isGiftCard: boolean; // <-- YENİ (Adım 5)
    available: number; // tüm lokasyonların toplamı
    byLocation: Record<string, number>;
    levelsTruncated: boolean;
};

export type VariantSales = {
    units: number;
    byDay: Record<string, number>; // "2026-03-21" -> adet (mağaza saat dilimi)
};

export type SalesSnapshot = {
    since: string;
    shopTimezone: string; // <-- YENİ (Adım 5)
    variants: Map<string, VariantInfo>;
    sales: Map<string, VariantSales>;
    stats: {
        variantPages: number;
        orderPages: number;
        ordersSeen: number;
        ordersCancelled: number;
        lineItemsSeen: number;
        lineItemsNoVariant: number;
        refundedOrRemovedUnits: number;
        extraLineItemFetches: number;
    };
};

// --- YENİ (Adım 5): mağaza saat dilimini almak için ---
const SHOP_QUERY = `#graphql
  query InvShop {
    shop {
      ianaTimezone
    }
  }`;

const VARIANTS_QUERY = `#graphql
  query InvVariants($cursor: String) {
    productVariants(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        product { id title status isGiftCard }
        inventoryItem {
          tracked
          inventoryLevels(first: 10) {
            pageInfo { hasNextPage }
            nodes {
              location { id name }
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    }
  }`;

const LINE_ITEM_FIELDS = `quantity currentQuantity variant { id } product { id }`;

const ORDERS_QUERY = `#graphql
  query InvOrders($cursor: String, $q: String!) {
    orders(first: 25, after: $cursor, sortKey: PROCESSED_AT, query: $q) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        processedAt
        cancelledAt
        lineItems(first: 25) {
          pageInfo { hasNextPage endCursor }
          nodes { ${LINE_ITEM_FIELDS} }
        }
      }
    }
  }`;

const ORDER_LINE_ITEMS_QUERY = `#graphql
  query InvOrderLineItems($id: ID!, $cursor: String) {
    order(id: $id) {
      lineItems(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ${LINE_ITEM_FIELDS} }
      }
    }
  }`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gql(admin: Admin, query: string, variables: Record<string, unknown>) {
    const res = await admin.graphql(query, { variables });
    const body = await res.json();
    if (body.errors?.length) {
        throw new Error(`GraphQL hatası: ${JSON.stringify(body.errors)}`);
    }
    // Kova azaldıysa dolmasını bekle (sessizce 429 yemek yerine)
    const t = body.extensions?.cost?.throttleStatus;
    if (t && t.currentlyAvailable < 300 && t.restoreRate > 0) {
        await sleep(Math.ceil((300 - t.currentlyAvailable) / t.restoreRate) * 1000);
    }
    return body.data;
}

// --- YENİ (Adım 5): UTC bir tarihi mağaza saat dilimindeki "YYYY-MM-DD" gününe çevirir ---
function toShopDay(isoUtc: string, timeZone: string): string {
    // en-CA formatı doğrudan YYYY-MM-DD üretir, ayrıca parse gerektirmez
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(isoUtc));
}

export async function fetchSalesSnapshot(admin: Admin, days = 365): Promise<SalesSnapshot> {
    // --- YENİ (Adım 5): mağaza saat dilimini bir kere çek ---
    const shopData = await gql(admin, SHOP_QUERY, {});
    const shopTimezone: string = shopData.shop?.ianaTimezone ?? "UTC";

    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const stats: SalesSnapshot["stats"] = {
        variantPages: 0, orderPages: 0, ordersSeen: 0, ordersCancelled: 0,
        lineItemsSeen: 0, lineItemsNoVariant: 0, refundedOrRemovedUnits: 0,
        extraLineItemFetches: 0,
    };

    // --- 1) Varyantlar + stok (sayfalı) ---
    const variants = new Map<string, VariantInfo>();
    let cursor: string | null = null;
    do {
        const data = await gql(admin, VARIANTS_QUERY, { cursor });
        stats.variantPages++;
        const conn = data.productVariants;
        for (const v of conn.nodes) {
            const levels = v.inventoryItem?.inventoryLevels;
            const byLocation: Record<string, number> = {};
            let available = 0;
            for (const lvl of levels?.nodes ?? []) {
                const q = lvl.quantities.find((x: any) => x.name === "available")?.quantity ?? 0;
                byLocation[lvl.location.name] = q;
                available += q;
            }
            variants.set(v.id, {
                variantId: v.id,
                variantTitle: v.title,
                productId: v.product.id,
                productTitle: v.product.title,
                status: v.product.status,
                tracked: v.inventoryItem?.tracked ?? false,
                isGiftCard: v.product.isGiftCard ?? false, // <-- YENİ (Adım 5)
                available,
                byLocation,
                levelsTruncated: levels?.pageInfo?.hasNextPage ?? false,
            });
        }
        cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (cursor);

    // --- 2) Siparişler (sayfalı) ---
    const sales = new Map<string, VariantSales>();
    const addLineItems = (items: any[], day: string) => {
        for (const li of items) {
            stats.lineItemsSeen++;
            stats.refundedOrRemovedUnits += li.quantity - li.currentQuantity;
            if (!li.variant) { stats.lineItemsNoVariant++; continue; } // silinmiş varyant / özel kalem
            const s = sales.get(li.variant.id) ?? { units: 0, byDay: {} };
            s.units += li.currentQuantity;
            s.byDay[day] = (s.byDay[day] ?? 0) + li.currentQuantity;
            sales.set(li.variant.id, s);
        }
    };

    cursor = null;
    const q = `processed_at:>=${since}`;
    do {
        const data = await gql(admin, ORDERS_QUERY, { cursor, q });
        stats.orderPages++;
        const conn = data.orders;
        for (const order of conn.nodes) {
            stats.ordersSeen++;
            if (order.cancelledAt) { stats.ordersCancelled++; continue; }
            // DEĞİŞTİ (Adım 5): UTC slice yerine mağaza saat dilimine göre gün
            const day = toShopDay(order.processedAt, shopTimezone);
            addLineItems(order.lineItems.nodes, day);

            // 25'ten fazla kalemli sipariş: kalanını ayrıca çek, sessizce kesme
            let liCursor = order.lineItems.pageInfo.hasNextPage ? order.lineItems.pageInfo.endCursor : null;
            while (liCursor) {
                stats.extraLineItemFetches++;
                const d = await gql(admin, ORDER_LINE_ITEMS_QUERY, { id: order.id, cursor: liCursor });
                addLineItems(d.order.lineItems.nodes, day);
                liCursor = d.order.lineItems.pageInfo.hasNextPage ? d.order.lineItems.pageInfo.endCursor : null;
            }
        }
        cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (cursor);

    return { since, shopTimezone, variants, sales, stats };
}

// --- YENİ (Adım 3): snapshot'ı diske yazıp geri okumak için ---
// Map JSON.stringify ile doğrudan yazılamıyor, çift dizi ([key, value][]) formatına çeviriyoruz.
export type SnapshotPlain = {
    since: string;
    shopTimezone: string;
    variants: [string, VariantInfo][];
    sales: [string, VariantSales][];
    stats: SalesSnapshot["stats"];
};

export function snapshotToPlain(snap: SalesSnapshot): SnapshotPlain {
    return {
        since: snap.since,
        shopTimezone: snap.shopTimezone,
        variants: [...snap.variants.entries()],
        sales: [...snap.sales.entries()],
        stats: snap.stats,
    };
}

export function snapshotFromPlain(plain: SnapshotPlain): SalesSnapshot {
    return {
        since: plain.since,
        shopTimezone: plain.shopTimezone,
        variants: new Map(plain.variants),
        sales: new Map(plain.sales),
        stats: plain.stats,
    };
}

export function logSnapshot(snap: SalesSnapshot, elapsedMs: number) {
    type Row = {
        ürün: string; durum: string; takip: string; giftCard: string; stok: number;
        satış: number; ilkSatış: string; sonSatış: string; lokasyonlar: string;
    };
    const rows = new Map<string, Row>();
    // DEĞİŞTİ (Adım 5): lokasyonları ürün bazında topluyoruz, tek varyantın üzerine yazmıyoruz
    const locationTotals = new Map<string, Record<string, number>>();
    let archivedSkipped = 0;
    let truncatedLevels = 0;

    for (const v of snap.variants.values()) {
        if (v.status === "ARCHIVED") { archivedSkipped++; continue; }
        if (v.levelsTruncated) truncatedLevels++;
        const s = snap.sales.get(v.variantId);
        const days = s ? Object.keys(s.byDay).sort() : [];
        const r = rows.get(v.productId) ?? {
            ürün: v.productTitle, durum: v.status, takip: "", giftCard: v.isGiftCard ? "evet" : "hayır",
            stok: 0, satış: 0, ilkSatış: "-", sonSatış: "-", lokasyonlar: "",
        };
        r.takip = r.takip === "" ? (v.tracked ? "evet" : "hayır")
            : r.takip === (v.tracked ? "evet" : "hayır") ? r.takip : "kısmen";
        if (v.tracked) r.stok += v.available;
        r.satış += s?.units ?? 0;
        if (days.length) {
            if (r.ilkSatış === "-" || days[0] < r.ilkSatış) r.ilkSatış = days[0];
            if (r.sonSatış === "-" || days.at(-1)! > r.sonSatış) r.sonSatış = days.at(-1)!;
        }

        // DEĞİŞTİ (Adım 5): bu ürünün lokasyon toplamına bu varyantın stoğunu ekle
        const totals = locationTotals.get(v.productId) ?? {};
        for (const [loc, qty] of Object.entries(v.byLocation)) {
            totals[loc] = (totals[loc] ?? 0) + qty;
        }
        locationTotals.set(v.productId, totals);

        rows.set(v.productId, r);
    }

    // DEĞİŞTİ (Adım 5): satır yazdırılmadan hemen önce toplu lokasyon string'i oluştur
    for (const [productId, r] of rows) {
        const totals = locationTotals.get(productId) ?? {};
        r.lokasyonlar = Object.entries(totals).map(([k, n]) => `${k}:${n}`).join(" ");
    }

    const sorted = [...rows.values()].sort((a, b) => b.satış - a.satış);
    const totalUnits = sorted.reduce((t, r) => t + r.satış, 0);

    console.log(`\n=== Satış anlık görüntüsü (since ${snap.since}, tz ${snap.shopTimezone}, ${(elapsedMs / 1000).toFixed(1)} sn) ===`);
    console.table(sorted);
    console.log({
        ...snap.stats,
        toplamAdet: totalUnits,
        arşivAtlananVaryant: archivedSkipped,
        lokasyonuKesilenVaryant: truncatedLevels,
    });
}