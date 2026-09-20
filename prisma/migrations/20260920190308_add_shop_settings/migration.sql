-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "coverageDays" INTEGER NOT NULL DEFAULT 30,
    "onboardedAt" DATETIME
);
