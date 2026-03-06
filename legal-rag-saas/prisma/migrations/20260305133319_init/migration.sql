-- CreateTable
CREATE TABLE "token_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_user_id_idx" ON "token_usage"("user_id");

-- CreateIndex
CREATE INDEX "token_usage_created_at_idx" ON "token_usage"("created_at");

-- CreateIndex
CREATE INDEX "token_transactions_user_id_idx" ON "token_transactions"("user_id");

-- CreateIndex
CREATE INDEX "token_transactions_created_at_idx" ON "token_transactions"("created_at");
