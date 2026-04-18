-- CreateTable
CREATE TABLE "AiClone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "personalityData" JSONB,
    "clonePrompt" TEXT,
    "allowMatching" BOOLEAN NOT NULL DEFAULT false,
    "gender" TEXT,
    "interestedIn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiClone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "clone1Id" TEXT NOT NULL,
    "clone2Id" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "chemistryScore" DOUBLE PRECISION,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloneViewPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "purchaseType" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloneViewPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiClone_userId_key" ON "AiClone"("userId");

-- CreateIndex
CREATE INDEX "AiClone_allowMatching_status_idx" ON "AiClone"("allowMatching", "status");

-- CreateIndex
CREATE INDEX "AiClone_instagramId_idx" ON "AiClone"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_clone1Id_clone2Id_key" ON "AiConversation"("clone1Id", "clone2Id");

-- CreateIndex
CREATE INDEX "AiConversation_status_idx" ON "AiConversation"("status");

-- CreateIndex
CREATE INDEX "CloneViewPurchase_userId_idx" ON "CloneViewPurchase"("userId");

-- AddForeignKey
ALTER TABLE "AiClone" ADD CONSTRAINT "AiClone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_clone1Id_fkey" FOREIGN KEY ("clone1Id") REFERENCES "AiClone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_clone2Id_fkey" FOREIGN KEY ("clone2Id") REFERENCES "AiClone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloneViewPurchase" ADD CONSTRAINT "CloneViewPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloneViewPurchase" ADD CONSTRAINT "CloneViewPurchase_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
