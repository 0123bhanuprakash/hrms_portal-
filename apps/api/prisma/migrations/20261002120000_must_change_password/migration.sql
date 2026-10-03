-- AlterTable: force a password change after a temporary password is issued
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;
