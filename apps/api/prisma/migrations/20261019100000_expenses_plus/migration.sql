-- AlterTable
ALTER TABLE "expense_categories" ADD COLUMN     "max_per_month_paise" INTEGER;

-- AlterTable
ALTER TABLE "expense_claims" ADD COLUMN     "question_open_by_id" UUID;

-- AlterTable
ALTER TABLE "expense_items" ADD COLUMN     "over_limit_reason" TEXT;

-- CreateTable
CREATE TABLE "expense_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claim_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_comments_claim_id_idx" ON "expense_comments"("claim_id");

-- AddForeignKey
ALTER TABLE "expense_comments" ADD CONSTRAINT "expense_comments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

