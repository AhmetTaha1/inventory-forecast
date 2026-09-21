-- CreateTable
CREATE TABLE "SnoozedVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "snoozeUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SnoozedVariant_shop_variantId_key" ON "SnoozedVariant"("shop", "variantId");
