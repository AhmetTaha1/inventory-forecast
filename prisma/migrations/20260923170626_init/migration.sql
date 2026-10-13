-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "shop" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "coverageDays" INTEGER NOT NULL DEFAULT 30,
    "onboardedAt" TIMESTAMP(3),
    "tourSeenAt" TIMESTAMP(3),
    "detailsTourSeenAt" TIMESTAMP(3),
    "settingsTourSeenAt" TIMESTAMP(3),

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "SnoozedVariant" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "snoozeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnoozedVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantLeadTimeOverride" (
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "leadTimeDays" INTEGER,
    "coverageDays" INTEGER,
    "supplierId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantLeadTimeOverride_pkey" PRIMARY KEY ("shop","variantId")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestPreference" (
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipient" TEXT NOT NULL,
    "lastSentDate" TEXT,

    CONSTRAINT "DigestPreference_pkey" PRIMARY KEY ("shop")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SnoozedVariant_shop_variantId_key" ON "SnoozedVariant"("shop", "variantId");

-- CreateIndex
CREATE INDEX "VariantLeadTimeOverride_shop_supplierId_idx" ON "VariantLeadTimeOverride"("shop", "supplierId");

-- CreateIndex
CREATE INDEX "Supplier_shop_idx" ON "Supplier"("shop");
