-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "question_open_by_id" UUID;

-- CreateTable
CREATE TABLE "leave_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "leave_request_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_comments_leave_request_id_idx" ON "leave_comments"("leave_request_id");

-- AddForeignKey
ALTER TABLE "leave_comments" ADD CONSTRAINT "leave_comments_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

