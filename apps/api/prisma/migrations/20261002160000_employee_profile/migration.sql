-- AlterTable
ALTER TABLE "employee_bank_details" ADD COLUMN     "account_last4" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "employee_statutory" DROP COLUMN "aadhar",
ADD COLUMN     "aadhaar_last4" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "show_birthday" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employee_personal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "personal_email" TEXT,
    "blood_group" TEXT,
    "marital_status" TEXT,
    "current_address" JSONB,
    "permanent_address" JSONB,
    "emergency_contact_name" TEXT,
    "emergency_contact_relation" TEXT,
    "emergency_contact_phone" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_personal_employee_id_key" ON "employee_personal"("employee_id");

-- CreateIndex
CREATE INDEX "employee_personal_company_id_idx" ON "employee_personal"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_documents_storage_key_key" ON "employee_documents"("storage_key");

-- CreateIndex
CREATE INDEX "employee_documents_company_id_employee_id_idx" ON "employee_documents"("company_id", "employee_id");

-- AddForeignKey
ALTER TABLE "employee_personal" ADD CONSTRAINT "employee_personal_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

