-- CreateTable
CREATE TABLE "ForecastAccuracy" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizonDays" INTEGER NOT NULL,
    "predictedDailyRate" DOUBLE PRECISION NOT NULL,
    "actualDailyRate" DOUBLE PRECISION,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "ForecastAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastAccuracy_shop_checkedAt_idx" ON "ForecastAccuracy"("shop", "checkedAt");

-- CreateIndex
CREATE INDEX "ForecastAccuracy_shop_variantId_idx" ON "ForecastAccuracy"("shop", "variantId");
