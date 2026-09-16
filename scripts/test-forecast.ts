// scripts/test-forecast.ts
// Adım 6: snapshot.json'ı diskten okur, computeForecast'ı çalıştırır, sonucu basar.
// Shopify'a bağlanmaz, shopify app dev gerektirmez.
//
// Çalıştırmak için: npx tsx scripts/test-forecast.ts

import fs from "node:fs";
import path from "node:path";
import { snapshotFromPlain, type SnapshotPlain } from "../app/lib/sales.server";
import { computeForecast } from "../app/lib/forecast";

const snapshotPath = path.join(process.cwd(), "snapshot.json");

if (!fs.existsSync(snapshotPath)) {
    console.error(`snapshot.json bulunamadı: ${snapshotPath}`);
    console.error("Önce admin panelde uygulama sayfasını açıp/yenileyip snapshot.json'ı oluştur (Adım 3).");
    process.exit(1);
}

const plain: SnapshotPlain = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
const snapshot = snapshotFromPlain(plain);

const result = computeForecast(snapshot);

console.log(`\n=== Tahmin sonucu (snapshot since: ${snapshot.since}, tz: ${snapshot.shopTimezone}) ===\n`);

console.log(`--- Motora giren varyantlar (${result.forecasts.length}) ---`);
console.table(
    result.forecasts.map((f) => ({
        ürün: f.productTitle,
        varyant: f.variantTitle,
        durum: f.status,
        confidence: f.confidence,
        oneOff: f.oneOffDetected,
        stok: f.available,
        dailyRate: f.dailyRate,
        stockoutInDays: f.stockoutInDays,
        method: f.method,
    })),
);

console.log(`\n--- Elenen varyantlar (${result.excluded.length}) ---`);
console.table(
    result.excluded.map((e) => ({
        ürün: e.productTitle,
        varyant: e.variantTitle,
        sebep: e.reason,
    })),
);

console.log(`\nToplam: ${result.forecasts.length} girdi, ${result.excluded.length} elenen.`);