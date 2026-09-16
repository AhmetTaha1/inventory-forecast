-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME
);
