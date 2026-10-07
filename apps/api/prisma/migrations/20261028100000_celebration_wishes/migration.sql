-- CreateTable
CREATE TABLE "celebration_wishes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "occasion" DATE NOT NULL,
    "years" INTEGER,
    "sticker" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "celebration_wishes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "celebration_wishes_employee_id_occasion_idx" ON "celebration_wishes"("employee_id", "occasion");

-- CreateIndex
CREATE INDEX "celebration_wishes_company_id_occasion_idx" ON "celebration_wishes"("company_id", "occasion");

-- CreateIndex
CREATE UNIQUE INDEX "celebration_wishes_from_user_id_employee_id_kind_occasion_key" ON "celebration_wishes"("from_user_id", "employee_id", "kind", "occasion");

-- AddForeignKey
ALTER TABLE "celebration_wishes" ADD CONSTRAINT "celebration_wishes_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration_wishes" ADD CONSTRAINT "celebration_wishes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

