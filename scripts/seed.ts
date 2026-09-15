/**
 * scripts/seed.ts
 *
 * Test magazasina gecmis tarihli siparis basar.
 * Bagimsiz calisir, uygulama koduna dokunmaz.
 *
 * Kullanim:
 *   npx tsx scripts/seed.ts --plan     Hicbir sey olusturmaz, plani yazar
 *   npx tsx scripts/seed.ts --small    ~15 siparis, hizli duman testi
 *   npx tsx scripts/seed.ts            Tam seed, ~60 siparis (~13 dakika)
 *   npx tsx scripts/seed.ts --cancel   Son uc siparisi iptal eder
 *
 * NOT: Dev store'da dakikada en fazla 5 siparis olusturulabiliyor.
 * Script bu yuzden her siparis arasinda bekliyor. Terminali kapatma.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------- ayarlar

const API_VERSION = "2026-07";
const THROTTLE_MS = 13_000; // 5/dk sinirinin biraz altinda kal
const SEED_TAG = "seed"; // butun uretilen siparisler bu etiketi alir

// ---------------------------------------------------------------- .env

function loadEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  } catch {
    die(
      ".env dosyasi bulunamadi.\n" +
      "Projenin kok dizininde oldugundan emin ol ve su iki satiri ekle:\n" +
      "  SEED_SHOP=magazan.myshopify.com\n" +
      "  SEED_TOKEN=shpat_...",
    );
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

if (!SHOP) die("SEED_SHOP tanimli degil (.env)");
if (!TOKEN) die("SEED_TOKEN tanimli degil (.env)");
if (!TOKEN.startsWith("shpat_")) {
  die("SEED_TOKEN 'shpat_' ile baslamiyor. Ornek metni gercek token ile degistirdin mi?");
}

// ---------------------------------------------------------------- GraphQL

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    die(`Yetki reddedildi (${res.status}). Token yanlis ya da izinler eksik.`);
  }

  const json: any = await res.json();

  if (json.errors) {
    throw new Error("GraphQL hatasi:\n" + JSON.stringify(json.errors, null, 2));
  }
  return json.data as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------- rastgele (tekrarlanabilir)

/** Ayni tohum ayni veriyi uretir. Motoru ayarlarken bu onemli. */
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

const rnd = makeRandom(20260915);

function pick(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

// ---------------------------------------------------------------- senaryolar

type SaleEvent = { daysAgo: number; qty: number };

type Scenario = {
  /** Urun basligi, magazadaki isimle birebir */
  title: string;
  /** Bu urun neyi test ediyor */
  tests: string;
  /** Motorun ne demesi beklendigi (Faz 2'de dogrulama icin) */
  expect: string;
  /** Satis olaylari */
  sales: (grid: number[]) => SaleEvent[];
};

const SCENARIOS: Scenario[] = [
  {
    title: "The Minimal Snowboard",
    tests: "Duzenli satis",
    expect: "Makul bir tukenme gunu. Temel durum.",
    sales: (grid) => grid.map((d) => ({ daysAgo: d, qty: pick(2, 4) })),
  },
  {
    title: "The Complete Snowboard",
    tests: "Son ayda 3 katina cikan satis",
    expect: "Trendi yakalamali. Duz ortalama fazla iyimser kalir.",
    sales: (grid) => {
      const out: SaleEvent[] = [];
      grid.forEach((d, idx) => {
        if (d > 30 && idx % 4 === 0) out.push({ daysAgo: d, qty: 1 });
        if (d <= 30) out.push({ daysAgo: d, qty: pick(3, 5) });
      });
      return out;
    },
  },
  {
    title: "The Videographer Snowboard",
    tests: "Mevsimsel patlama, sonra olu sezon",
    expect:
      "ASIRI TAHMIN TUZAGI. 180 gunun duz ortalamasi 'hizli satiyor' der, " +
      "gercekte son 3 aydir hic satmiyor.",
    sales: (grid) => grid.filter((d) => d >= 90).map((d) => ({ daysAgo: d, qty: pick(3, 6) })),
  },
  {
    title: "The Collection Snowboard: Hydrogen",
    tests: "Tek seferlik toptan siparis",
    expect:
      "TA3 TUZAGI. 45 gun once tek seferde 50 adet. Motor bunu 'gunluk hiz' " +
      "sanip 'yarin bitecek' dememeli.",
    sales: () => [{ daysAgo: 45, qty: 50 }],
  },
  {
    title: "The Compare at Price Snowboard",
    tests: "Az stok (10), duzenli satis",
    expect: "ACIL uyari vermeli. En kritik urun bu olmali.",
    sales: (grid) => grid.filter((d) => d <= 21).map((d) => ({ daysAgo: d, qty: pick(2, 3) })),
  },
  {
    title: "The Inventory Not Tracked Snowboard",
    tests: "Stok takibi kapali urun",
    expect: "Tahmine HIC girmemeli. Stok bilgisi olmayan urune tahmin yapilamaz.",
    sales: (grid) => {
      const out: SaleEvent[] = [];
      grid.forEach((d, idx) => {
        if (d <= 60 && idx % 4 === 0) out.push({ daysAgo: d, qty: 1 });
      });
      return out;
    },
  },
  {
    title: "Selling Plans Ski Wax",
    tests: "Hic satilmamis, stok 30",
    expect: "OLU STOK raporunda cikmali.",
    sales: () => [],
  },
  {
    title: "The Hidden Snowboard",
    tests: "Hic satilmamis, gizli urun",
    expect: "OLU STOK raporunda cikmali.",
    sales: () => [],
  },
  {
    title: "The Archived Snowboard",
    tests: "Arsivlenmis urun",
    expect: "Hicbir listede gorunmemeli.",
    sales: () => [],
  },
  {
    title: "Gift Card",
    tests: "Envantersiz urun",
    expect: "Tahmine girmemeli.",
    sales: () => [],
  },
];

// ---------------------------------------------------------------- urunleri cek

type Variant = { id: string; title: string; tracked: boolean };
type Product = { id: string; title: string; status: string; variants: Variant[] };

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          status
          totalInventory
          variants(first: 10) {
            edges {
              node {
                id
                title
                inventoryItem { id tracked }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchProducts(): Promise<Product[]> {
  const out: Product[] = [];
  let cursor: string | null = null;

  for (; ;) {
    const data: any = await gql(PRODUCTS_QUERY, { cursor });
    for (const edge of data.products.edges) {
      const n = edge.node;
      out.push({
        id: n.id,
        title: n.title,
        status: n.status,
        variants: n.variants.edges.map((ve: any) => ({
          id: ve.node.id,
          title: ve.node.title,
          tracked: ve.node.inventoryItem?.tracked ?? false,
        })),
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out;
}

// ---------------------------------------------------------------- siparis olustur

const ORDER_CREATE = `
  mutation SeedOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name processedAt }
      userErrors { field message }
    }
  }
`;

type LineItem = { variantId: string; quantity: number };

async function createOrder(processedAt: string, lineItems: LineItem[]): Promise<string> {
  const data: any = await gql(ORDER_CREATE, {
    order: {
      processedAt,
      lineItems,
      financialStatus: "PAID",
      tags: [SEED_TAG],
    },
    options: {
      // BYPASS: stogu dusurme. Stok adetlerini admin panelinden elle veriyoruz,
      // boylece satis gecmisi ile mevcut stok bagimsiz kontrol edilebiliyor.
      inventoryBehaviour: "BYPASS",
      sendReceipt: false,
      sendFulfillmentReceipt: false,
    },
  });

  const errs = data.orderCreate.userErrors;
  if (errs && errs.length) {
    throw new Error("orderCreate reddetti:\n" + JSON.stringify(errs, null, 2));
  }
  return data.orderCreate.order.name;
}

// ---------------------------------------------------------------- iptal

const ORDERS_BY_TAG = `
  query SeedOrders {
    orders(first: 10, query: "tag:${SEED_TAG}", sortKey: CREATED_AT, reverse: true) {
      edges { node { id name cancelledAt } }
    }
  }
`;

const ORDER_CANCEL = `
  mutation SeedCancel(
    $orderId: ID!
    $reason: OrderCancelReason!
    $refundMethod: OrderCancelRefundMethodInput!
    $restock: Boolean!
    $notifyCustomer: Boolean
  ) {
    orderCancel(
      orderId: $orderId
      reason: $reason
      refundMethod: $refundMethod
      restock: $restock
      notifyCustomer: $notifyCustomer
    ) {
      job { id }
      orderCancelUserErrors { field message code }
      userErrors { field message }
    }
  }
`;

async function cancelRecent(count: number): Promise<void> {
  const data: any = await gql(ORDERS_BY_TAG);
  const orders = data.orders.edges.map((e: any) => e.node).filter((o: any) => !o.cancelledAt);

  if (!orders.length) {
    console.log("Iptal edilecek siparis bulunamadi.");
    return;
  }

  console.log("\nDIKKAT: Siparis iptali geri alinamaz.\n");

  for (const o of orders.slice(0, count)) {
    try {
      const res: any = await gql(ORDER_CANCEL, {
        orderId: o.id,
        reason: "CUSTOMER",
        refundMethod: { originalPaymentMethodsRefund: true },
        restock: false,
        notifyCustomer: false,
      });
      const errs = [
        ...(res.orderCancel.orderCancelUserErrors ?? []),
        ...(res.orderCancel.userErrors ?? []),
      ];
      if (errs.length) {
        console.log(`  ${o.name} iptal edilemedi: ${JSON.stringify(errs)}`);
      } else {
        console.log(`  ${o.name} iptal edildi`);
      }
    } catch (err) {
      console.log(`  ${o.name} iptal hatasi: ${(err as Error).message}`);
    }
    await sleep(1500);
  }
}

// ---------------------------------------------------------------- plan kur

type PlannedOrder = { daysAgo: number; iso: string; items: Array<{ title: string; variantId: string; qty: number }> };

function buildGrid(daysBack: number, step: number): number[] {
  const grid: number[] = [];
  for (let d = daysBack - 1; d >= 0; d -= step) grid.push(d);
  return grid;
}

function isoForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(pick(9, 18), pick(0, 59), 0, 0);
  return d.toISOString();
}

function buildPlan(products: Product[], daysBack: number, step: number): PlannedOrder[] {
  const grid = buildGrid(daysBack, step);
  const byDay = new Map<number, PlannedOrder["items"]>();
  const missing: string[] = [];

  for (const sc of SCENARIOS) {
    const product = products.find((p) => p.title === sc.title);
    if (!product) {
      missing.push(sc.title);
      continue;
    }
    const variant = product.variants[0];
    if (!variant) continue;

    for (const sale of sc.sales(grid)) {
      if (sale.qty <= 0) continue;
      const list = byDay.get(sale.daysAgo) ?? [];
      list.push({ title: sc.title, variantId: variant.id, qty: sale.qty });
      byDay.set(sale.daysAgo, list);
    }
  }

  if (missing.length) {
    console.log("\nUYARI: Su urunler magazada bulunamadi, atlandi:");
    for (const m of missing) console.log("  - " + m);
    console.log("");
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0]) // en eskiden en yeniye
    .map(([daysAgo, items]) => ({ daysAgo, iso: isoForDaysAgo(daysAgo), items }));
}

// ---------------------------------------------------------------- calistir

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const planOnly = args.includes("--plan");
  const small = args.includes("--small");
  const cancelMode = args.includes("--cancel");

  console.log(`\nMagaza : ${SHOP}`);
  console.log(`API    : ${API_VERSION}\n`);

  if (cancelMode) {
    await cancelRecent(3);
    return;
  }

  const daysBack = small ? 45 : 180;
  const step = small ? 3 : 3;

  console.log("Urunler cekiliyor...");
  const products = await fetchProducts();
  console.log(`${products.length} urun bulundu.\n`);

  const plan = buildPlan(products, daysBack, step);
  const totalUnits = plan.reduce((s, o) => s + o.items.reduce((t, i) => t + i.qty, 0), 0);
  const minutes = Math.ceil((plan.length * THROTTLE_MS) / 60000);

  console.log("--- PLAN ---");
  console.log(`Siparis sayisi : ${plan.length}`);
  console.log(`Toplam adet    : ${totalUnits}`);
  console.log(`Tarih araligi  : son ${daysBack} gun`);
  console.log(`Tahmini sure   : ~${minutes} dakika (dev store limiti: 5 siparis/dk)\n`);

  console.log("--- URUN SENARYOLARI ---");
  for (const sc of SCENARIOS) {
    const units = plan
      .flatMap((o) => o.items)
      .filter((i) => i.title === sc.title)
      .reduce((s, i) => s + i.qty, 0);
    console.log(`\n${sc.title}`);
    console.log(`  test   : ${sc.tests}`);
    console.log(`  satis  : ${units} adet`);
    console.log(`  beklen : ${sc.expect}`);
  }
  console.log("");

  // Faz 2'de motorun ciktisini bununla karsilastiracagiz
  const planPath = resolve(process.cwd(), "seed-plan.json");
  writeFileSync(
    planPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        shop: SHOP,
        daysBack,
        orders: plan,
        scenarios: SCENARIOS.map((s) => ({ title: s.title, tests: s.tests, expect: s.expect })),
      },
      null,
      2,
    ),
  );
  console.log(`Plan yazildi: ${planPath}\n`);

  if (planOnly) {
    console.log("--plan modu: hicbir siparis olusturulmadi.\n");
    return;
  }

  console.log("Siparisler olusturuluyor. Terminali kapatma.\n");

  const started = Date.now();
  let done = 0;
  let failed = 0;

  for (const order of plan) {
    const lineItems: LineItem[] = order.items.map((i) => ({
      variantId: i.variantId,
      quantity: i.qty,
    }));

    try {
      const name = await createOrder(order.iso, lineItems);
      done++;
      const left = plan.length - done - failed;
      const eta = Math.ceil((left * THROTTLE_MS) / 60000);
      const day = order.iso.slice(0, 10);
      const what = order.items.map((i) => `${i.title.slice(0, 22)} x${i.qty}`).join(", ");
      console.log(`[${done}/${plan.length}] ${name}  ${day}  ${what}   (~${eta} dk kaldi)`);
    } catch (err) {
      failed++;
      console.log(`[HATA] ${order.iso.slice(0, 10)} -> ${(err as Error).message}`);
      if (failed >= 3) {
        die("Ust uste hata alindi, duruyorum. Yukaridaki mesaji incele.");
      }
    }

    if (done + failed < plan.length) await sleep(THROTTLE_MS);
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\nBitti. ${done} siparis olusturuldu, ${failed} hata. Sure: ${mins} dakika.\n`);
  console.log("Sonraki adim: Shopify admin > Urunler > her urune stok adedi ver.");
  console.log("Onerilen: Compare at Price = 10, Ski Wax = 30, digerleri = 50\n");
}

main().catch((err) => {
  console.error("\nBEKLENMEYEN HATA\n");
  console.error(err);
  process.exit(1);
});
