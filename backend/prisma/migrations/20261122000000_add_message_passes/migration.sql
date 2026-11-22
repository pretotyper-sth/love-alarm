BEGIN;
-- DropForeignKey
ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_alarmId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messagePassBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MessageReaction" ADD COLUMN     "messageId" TEXT,
ALTER COLUMN "alarmId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VerificationSession" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "alarmId" TEXT,
    "targetInstagramId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "requiresPass" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePassOrder" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePassOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "MessagePassEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePassEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageDelivery_targetInstagramId_createdAt_idx" ON "MessageDelivery"("targetInstagramId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageUnlock_userId_messageId_key" ON "MessageUnlock"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagePassEntry_reference_key" ON "MessagePassEntry"("reference");

-- CreateIndex
CREATE INDEX "MessagePassEntry_userId_createdAt_idx" ON "MessagePassEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReport_userId_messageId_key" ON "MessageReport"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_key" ON "MessageReaction"("messageId");

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUnlock" ADD CONSTRAINT "MessageUnlock_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MessagePassOrder"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUnlock" ADD CONSTRAINT "MessageUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageUnlock" ADD CONSTRAINT "MessageUnlock_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePassOrder" ADD CONSTRAINT "MessagePassOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePassEntry" ADD CONSTRAINT "MessagePassEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReport" ADD CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing messages stay free, including messages read on another device.
INSERT INTO "MessageDelivery" ("id", "alarmId", "targetInstagramId", "message", "requiresPass", "createdAt", "deletedAt")
SELECT "id", "id", lower(trim("targetInstagramId")), "message", false, "createdAt", "deletedAt"
FROM "Alarm" WHERE "message" IS NOT NULL AND length(trim("message")) > 0;
UPDATE "MessageReaction" r SET "messageId" = r."alarmId"
WHERE EXISTS (SELECT 1 FROM "MessageDelivery" m WHERE m.id = r."alarmId");
ALTER TABLE "User" ADD CONSTRAINT "User_messagePassBalance_nonnegative" CHECK ("messagePassBalance" >= 0);
ALTER TABLE "MessagePassOrder" ADD CONSTRAINT "MessagePassOrder_remaining_valid" CHECK ("remaining" >= 0 AND "remaining" <= "quantity");

COMMIT;
