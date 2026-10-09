-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "prior_experience_pending_months" INTEGER,
ADD COLUMN     "prior_experience_submitted_at" TIMESTAMP(3),
ADD COLUMN     "prior_experience_verified_at" TIMESTAMP(3),
ADD COLUMN     "prior_experience_verified_by_id" UUID;

