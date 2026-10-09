-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "cancel_request_last_day" DATE,
ADD COLUMN     "cancel_request_reason" TEXT,
ADD COLUMN     "cancel_requested_at" TIMESTAMP(3);

