/**
 * scripts/seed-catalog.ts
 *
 * App Store ekran görüntüleri için: test mağazasına ~230 GERÇEK ürün +
 * bunlara ait geçmiş siparişler basar. scripts/seed.ts'ten (mevcut 10
 * sabit senaryo ürünü, sadece sipariş ekliyor) FARKLI — bu script ÜRÜNLERİ
 * DE kendisi oluşturuyor, farklı satış hızı profillerinde (çok satan,
 * yavaş satan, ölü stok, stokta yok, veri yetersiz) geniş bir katalog
 * üretmek için. Amaç: panel + ürün detay grafikleri ekran görüntüsünde
 * zengin/gerçekçi görünsün.
 *
 * Bağımsız çalışır, uygulama koduna dokunmaz.
 *
 * Kullanım:
 *   npx tsx scripts/seed-catalog.ts --plan          Hiçbir şey oluşturmaz, planı yazar
 *   npx tsx scripts/seed-catalog.ts --small          ~20 ürün, hızlı duman testi
 *   npx tsx scripts/seed-catalog.ts                  Tam seed (~230 ürün + ~60 sipariş)
 *   npx tsx scripts/seed-catalog.ts --count=150       Ürün sayısını özelleştir
 *
 * NOT: Dev store'da dakikada en fazla 5 sipariş oluşturulabiliyor (aynı kısıt
 * scripts/seed.ts'te de var) — bu yüzden siparişler GÜNE GÖRE gruplanıyor
 * (tek bir gün için tüm ürünlerin satışı TEK siparişte), ürün sayısı arttıkça
 * sipariş sayısı ARTMIYOR. Ürün oluşturma (productSet) bu kısıta tabi değil,
 * çok daha hızlı.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_VERSION = "2026-07";
const ORDER_THROTTLE_MS = 13_000;
const PRODUCT_THROTTLE_MS = 300;
const SEED_TAG = "seed-catalog";
const DAYS_BACK = 120;
const GRID_STEP = 2;

function loadEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  } catch {
    die(".env dosyası bulunamadı. SEED_SHOP ve SEED_TOKEN gerekli (bkz. scripts/seed.ts).");
    return;
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function die(msg: string): never {
  console.error("\nHATA: " + msg + "\n");
  process.exit(1);
}

loadEnv();

const SHOP = process.env.SEED_SHOP;
const TOKEN = process.env.SEED_TOKEN;
if (!SHOP) die("SEED_SHOP tanımlı değil (.env)");
if (!TOKEN) die("SEED_TOKEN tanımlı değil (.env)");

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN! },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 || res.status === 403) die(`Yetki reddedildi (${res.status}).`);
  const json: any = await res.json();
  if (json.errors) throw new Error("GraphQL hatası:\n" + JSON.stringify(json.errors, null, 2));
  return json.data as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------- rastgele (tekrarlanabilir)
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = makeRandom(20260922);
function pick(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

// ---------------------------------------------------------------- isim üretici
// Sadece "Snowboard" değil, gerçekçi bir kış sporları mağazası gibi
// görünsün diye geniş bir ürün kategorisi yelpazesi — mevcut 10 sabit
// senaryo ürünüyle (hepsi "Snowboard") ÇAKIŞMAYACAK şekilde bilinçli
// olarak farklı kategoriler seçildi.
const ADJECTIVES = [
  "Alpine", "Summit", "Glacier", "Ridge", "Arctic", "Powder", "Backcountry",
  "Freestyle", "Classic", "Pro", "Trail", "Storm", "Frost", "Peak", "Basecamp",
];
const BASE_NAMES = [
  "Ski Poles", "Winter Jacket", "Thermal Gloves", "Snow Goggles", "Beanie Hat",
  "Insulated Boots", "Base Layer Top", "Fleece Pullover", "Ski Helmet", "Snow Pants",
  "Neck Gaiter", "Hand Warmers Pack", "Ski Bag", "Board Wax Kit", "Binding Set",
  "Trail Backpack", "Merino Socks", "Balaclava", "Goggle Case", "Chairlift Pass Holder",
  "Travel Thermos", "Cabin Slippers", "Ski Wax Iron", "Avalanche Probe", "Crampons",
];

function buildProductNames(count: number): string[] {
  const combos: string[] = [];
  for (const adj of ADJECTIVES) {
    for (const base of BASE_NAMES) {
      combos.push(`${adj} ${base}`);
    }
  }
  // Tekrar etmeyecek şekilde karıştır (Fisher-Yates, tekrarlanabilir rnd ile)
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  if (count > combos.length) die(`En fazla ${combos.length} benzersiz isim üretilebilir.`);
  return combos.slice(0, count);
}

// ---------------------------------------------------------------- satış hızı profilleri
// Amaç: panel özet kartlarının (tükendi/azalıyor/ölü stok/veri yok) VE ürün
// detay grafiklerinin (özellikle çok satanların dolgun bir çubuk grafiği,
// düşen bir projeksiyon çizgisi olsun) ekran görüntüsünde zengin görünmesi.
type Profile = {
  name: string;
  share: number; // toplam içindeki oran (0-1), toplamı 1 olmalı
  dailyQty: [number, number] | null; // her grid gününde satılan adet aralığı; null = hiç satış yok
  saleEveryNthDay: number; // 1 = her grid gününde satış, 3 = her 3 günde bir
  recentCutoffDays: number | null; // varsa, bu günden daha yeni satış YOK (ölü stok simülasyonu)
  onlyFirstNDays: number | null; // varsa, sadece grid'in en eski N günü satış var (insufficient data simülasyonu)
  available: [number, number]; // stok aralığı
  outOfStock: boolean;
  splitAcrossLocations: boolean;
};

const PROFILES: Profile[] = [
  {
    name: "bestseller",
    share: 20 / 230,
    dailyQty: [15, 35],
    saleEveryNthDay: 1,
    recentCutoffDays: null,
    onlyFirstNDays: null,
    available: [80, 500],
    outOfStock: false,
    splitAcrossLocations: true,
  },
  {
    name: "fast",
    share: 40 / 230,
    dailyQty: [4, 10],
    saleEveryNthDay: 1,
    recentCutoffDays: null,
    onlyFirstNDays: null,
    available: [60, 220],
    outOfStock: false,
    splitAcrossLocations: true,
  },
  {
    name: "medium",
    share: 60 / 230,
    dailyQty: [1, 3],
    saleEveryNthDay: 2,
    recentCutoffDays: null,
    onlyFirstNDays: null,
    available: [30, 90],
    outOfStock: false,
    splitAcrossLocations: false,
  },
  {
    name: "slow",
    share: 50 / 230,
    dailyQty: [1, 2],
    saleEveryNthDay: 5,
    recentCutoffDays: null,
    onlyFirstNDays: null,
    available: [15, 45],
    outOfStock: false,
    splitAcrossLocations: false,
  },
  {
    name: "dead",
    share: 30 / 230,
    dailyQty: [2, 5],
    saleEveryNthDay: 4,
    recentCutoffDays: 60, // son 60 gündür hiç satış yok -> "no_recent_sales"
    onlyFirstNDays: null,
    available: [10, 40],
    outOfStock: false,
    splitAcrossLocations: false,
  },
  {
    name: "noData",
    share: 10 / 230,
    dailyQty: [1, 2],
    saleEveryNthDay: 3,
    recentCutoffDays: null,
    onlyFirstNDays: 10, // sadece son 10 günde satış var -> insufficient_data
    available: [10, 30],
    outOfStock: false,
    splitAcrossLocations: false,
  },
  {
    name: "outOfStock",
    share: 20 / 230,
    dailyQty: [3, 8],
    saleEveryNthDay: 1,
    recentCutoffDays: null,
    onlyFirstNDays: null,
    available: [0, 0],
    outOfStock: true,
    splitAcrossLocations: false,
  },
];

// ---------------------------------------------------------------- plan tipleri
type SaleEvent = { daysAgo: number; qty: number };
type ProductPlan = {
  title: string;
  profile: string;
  available: number;
  splitAcrossLocations: boolean;
  sales: SaleEvent[];
};

function buildGrid(daysBack: number, step: number): number[] {
  const grid: number[] = [];
  for (let d = daysBack - 1; d >= 0; d -= step) grid.push(d);
  return grid;
}

function buildSalesForProfile(profile: Profile, grid: number[]): SaleEvent[] {
  if (!profile.dailyQty) return [];
  const [min, max] = profile.dailyQty;
  const events: SaleEvent[] = [];
  grid.forEach((d, idx) => {
    if (idx % profile.saleEveryNthDay !== 0) return;
    if (profile.recentCutoffDays != null && d < profile.recentCutoffDays) return;
    if (profile.onlyFirstNDays != null && d < grid[0] - profile.onlyFirstNDays) return;
    events.push({ daysAgo: d, qty: pick(min, max) });
  });
  return events;
}

function buildCatalogPlan(count: number): ProductPlan[] {
  const grid = buildGrid(DAYS_BACK, GRID_STEP);
  const names = buildProductNames(count);

  // Her profile share'ine göre kaç ürün düşeceğini hesapla, toplamı count'a
  // eşitle (yuvarlama farkını son profile ekle).
  const counts = PROFILES.map((p) => Math.round(p.share * count));
  const diff = count - counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] += diff;

  const plans: ProductPlan[] = [];
  let nameIdx = 0;
  PROFILES.forEach((profile, i) => {
    for (let n = 0; n < counts[i]; n++) {
      const title = names[nameIdx++];
      plans.push({
        title,
        profile: profile.name,
        available: profile.outOfStock ? 0 : pick(profile.available[0], profile.available[1]),
        splitAcrossLocations: profile.splitAcrossLocations,
        sales: buildSalesForProfile(profile, grid),
      });
    }
  });
  return plans;
}

// ---------------------------------------------------------------- Shopify'dan oku
const SETUP_QUERY = `
  query CatalogSeedSetup {
    locations(first: 5) {
      edges { node { id name } }
    }
    products(first: 20) {
      edges { node { featuredMedia { preview { image { url } } } } }
    }
  }
`;

async function fetchSetup(): Promise<{ locationIds: string[]; imageUrls: string[] }> {
  const data: any = await gql(SETUP_QUERY);
  const locationIds = data.locations.edges.map((e: any) => e.node.id);
  const imageUrls = [
    ...new Set(
      data.products.edges
        .map((e: any) => e.node.featuredMedia?.preview?.image?.url as string | undefined)
        .filter((u: string | undefined): u is string => Boolean(u))
        .map((u: string) => u.split("?")[0]),
    ),
  ] as string[];
  if (locationIds.length === 0) die("Mağazada hiç lokasyon bulunamadı.");
  return { locationIds, imageUrls };
}

// ---------------------------------------------------------------- ürün oluştur
const PRODUCT_SET = `
  mutation CreateSeedProduct($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        id
        variants(first: 1) { nodes { id } }
      }
      userErrors { field message }
    }
  }
`;

async function createProduct(
  plan: ProductPlan,
  locationIds: string[],
  imageUrl: string | null,
): Promise<string> {
  const inventoryQuantities = plan.splitAcrossLocations && locationIds.length > 1
    ? [
        { locationId: locationIds[0], name: "available", quantity: Math.ceil(plan.available * 0.6) },
        { locationId: locationIds[1], name: "available", quantity: Math.floor(plan.available * 0.4) },
      ]
    : [{ locationId: locationIds[0], name: "available", quantity: plan.available }];

  const input: Record<string, unknown> = {
    title: plan.title,
    status: "ACTIVE",
    tags: [SEED_TAG],
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: (Math.round((9.99 + rnd() * 90) * 100) / 100).toFixed(2),
        inventoryItem: { tracked: true },
        inventoryQuantities,
      },
    ],
  };
  if (imageUrl) {
    input.files = [{ originalSource: imageUrl, alt: plan.title, contentType: "IMAGE" }];
  }

  const data: any = await gql(PRODUCT_SET, { input });
  const errs = data.productSet.userErrors;
  if (errs && errs.length) throw new Error("productSet reddetti:\n" + JSON.stringify(errs, null, 2));
  return data.productSet.product.variants.nodes[0].id as string;
}

// ---------------------------------------------------------------- sipariş oluştur (scripts/seed.ts ile aynı desen)
const ORDER_CREATE = `
  mutation SeedOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { name }
      userErrors { field message }
    }
  }
`;

function isoForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(pick(9, 18), pick(0, 59), 0, 0);
  return d.toISOString();
}

async function createOrder(processedAt: string, lineItems: Array<{ variantId: string; quantity: number }>): Promise<string> {
  const data: any = await gql(ORDER_CREATE, {
    order: { processedAt, lineItems, financialStatus: "PAID", tags: [SEED_TAG] },
    options: { inventoryBehaviour: "BYPASS", sendReceipt: false, sendFulfillmentReceipt: false },
  });
  const errs = data.orderCreate.userErrors;
  if (errs && errs.length) throw new Error("orderCreate reddetti:\n" + JSON.stringify(errs, null, 2));
  return data.orderCreate.order.name;
}

// ---------------------------------------------------------------- çalıştır
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const planOnly = args.includes("--plan");
  const small = args.includes("--small");
  const countArg = args.find((a) => a.startsWith("--count="));
  const count = small ? 20 : countArg ? Number(countArg.split("=")[1]) : 230;

  console.log(`\nMağaza      : ${SHOP}`);
  console.log(`Ürün sayısı : ${count}\n`);

  const catalogPlan = buildCatalogPlan(count);

  // Ürünleri güne göre grupla — tek gün için TEK sipariş, kaç ürün olursa
  // olsun sipariş sayısı grid boyutunu (DAYS_BACK/GRID_STEP) aşmıyor.
  const byDay = new Map<number, Array<{ title: string; qty: number; variantIndex: number }>>();
  catalogPlan.forEach((p, productIndex) => {
    for (const sale of p.sales) {
      const list = byDay.get(sale.daysAgo) ?? [];
      list.push({ title: p.title, qty: sale.qty, variantIndex: productIndex });
      byDay.set(sale.daysAgo, list);
    }
  });
  const orderDays = [...byDay.keys()].sort((a, b) => b - a);

  const profileCounts: Record<string, number> = {};
  for (const p of catalogPlan) profileCounts[p.profile] = (profileCounts[p.profile] ?? 0) + 1;

  console.log("--- PLAN ---");
  console.log(`Toplam ürün    : ${catalogPlan.length}`);
  for (const [profile, n] of Object.entries(profileCounts)) console.log(`  ${profile.padEnd(12)}: ${n}`);
  console.log(`Sipariş sayısı : ${orderDays.length} (gün başına 1, ürün sayısından bağımsız)`);
  const productMinutes = Math.ceil((catalogPlan.length * PRODUCT_THROTTLE_MS) / 60000);
  const orderMinutes = Math.ceil((orderDays.length * ORDER_THROTTLE_MS) / 60000);
  console.log(`Tahmini süre   : ~${productMinutes} dk ürün oluşturma + ~${orderMinutes} dk sipariş = ~${productMinutes + orderMinutes} dk\n`);

  const planPath = resolve(process.cwd(), "seed-catalog-plan.json");
  writeFileSync(
    planPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), shop: SHOP, count, profileCounts, orderDayCount: orderDays.length }, null, 2),
  );
  console.log(`Plan yazıldı: ${planPath}\n`);

  if (planOnly) {
    console.log("--plan modu: hiçbir ürün/sipariş oluşturulmadı.\n");
    return;
  }

  console.log("Kurulum bilgisi (lokasyonlar, mevcut ürün görselleri) çekiliyor...");
  const { locationIds, imageUrls } = await fetchSetup();
  console.log(`${locationIds.length} lokasyon, ${imageUrls.length} farklı görsel bulundu.\n`);

  console.log("Ürünler oluşturuluyor. Terminali kapatma.\n");
  const variantIdByProductIndex: string[] = [];
  for (let i = 0; i < catalogPlan.length; i++) {
    const plan = catalogPlan[i];
    const imageUrl = imageUrls.length > 0 ? pickOne(imageUrls) : null;
    try {
      const variantId = await createProduct(plan, locationIds, imageUrl);
      variantIdByProductIndex[i] = variantId;
      if ((i + 1) % 10 === 0 || i === catalogPlan.length - 1) {
        console.log(`[${i + 1}/${catalogPlan.length}] ürün oluşturuldu (son: ${plan.title})`);
      }
    } catch (err) {
      console.log(`[HATA] "${plan.title}" oluşturulamadı: ${(err as Error).message}`);
    }
    await sleep(PRODUCT_THROTTLE_MS);
  }
  console.log("\nÜrün oluşturma tamamlandı.\n");

  console.log(`Siparişler oluşturuluyor (${orderDays.length} gün, ~${orderMinutes} dk sürecek). Terminali kapatma.\n`);
  let done = 0;
  let failed = 0;
  for (const daysAgo of orderDays) {
    const items = byDay.get(daysAgo)!;
    const lineItems = items
      .map((it) => ({ variantId: variantIdByProductIndex[it.variantIndex], quantity: it.qty }))
      .filter((li) => li.variantId); // oluşturulamayan ürünleri atla

    if (lineItems.length > 0) {
      try {
        const name = await createOrder(isoForDaysAgo(daysAgo), lineItems);
        done++;
        console.log(`[${done + failed}/${orderDays.length}] ${name}  ${lineItems.length} kalem`);
      } catch (err) {
        failed++;
        console.log(`[HATA] gün -${daysAgo}: ${(err as Error).message}`);
      }
    }
    if (done + failed < orderDays.length) await sleep(ORDER_THROTTLE_MS);
  }

  console.log(`\nBitti. ${catalogPlan.length} ürün, ${done} sipariş oluşturuldu (${failed} sipariş hatası).\n`);
  console.log(`Not: Hepsi "${SEED_TAG}" etiketiyle işaretli — toplu silmek istersen Shopify admin'de bu etikete göre filtreleyip seçebilirsin.\n`);
}

main().catch((err) => {
  console.error("\nBEKLENMEYEN HATA\n");
  console.error(err);
  process.exit(1);
});
