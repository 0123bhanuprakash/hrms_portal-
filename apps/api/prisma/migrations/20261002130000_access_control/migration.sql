-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FeatureOverride" AS ENUM ('ON', 'OFF');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "features_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "hierarchy_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "plan_id" UUID;

-- AlterTable
ALTER TABLE "designations" ADD COLUMN     "org_level_id" UUID;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "deprecated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feature_key" TEXT,
ADD COLUMN     "label" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "is_owner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_template" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "key" TEXT,
ADD COLUMN     "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updated_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "plan_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "limits" JSONB,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_id","feature_key")
);

-- CreateTable
CREATE TABLE "company_features" (
    "company_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "mode" "FeatureOverride" NOT NULL,
    "limits" JSONB,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "set_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_features_pkey" PRIMARY KEY ("company_id","feature_key")
);

-- CreateTable
CREATE TABLE "org_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_hierarchy" (
    "company_id" UUID NOT NULL,
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "employee_hierarchy_pkey" PRIMARY KEY ("ancestor_id","descendant_id")
);

-- CreateTable
CREATE TABLE "department_hierarchy" (
    "company_id" UUID NOT NULL,
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "department_hierarchy_pkey" PRIMARY KEY ("ancestor_id","descendant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "org_levels_company_id_name_key" ON "org_levels"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "org_levels_company_id_rank_key" ON "org_levels"("company_id", "rank");

-- CreateIndex
CREATE INDEX "employee_hierarchy_descendant_id_idx" ON "employee_hierarchy"("descendant_id");

-- CreateIndex
CREATE INDEX "employee_hierarchy_company_id_idx" ON "employee_hierarchy"("company_id");

-- CreateIndex
CREATE INDEX "department_hierarchy_descendant_id_idx" ON "department_hierarchy"("descendant_id");

-- CreateIndex
CREATE INDEX "department_hierarchy_company_id_idx" ON "department_hierarchy"("company_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_org_level_id_fkey" FOREIGN KEY ("org_level_id") REFERENCES "org_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_features" ADD CONSTRAINT "company_features_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_levels" ADD CONSTRAINT "org_levels_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hierarchy" ADD CONSTRAINT "employee_hierarchy_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hierarchy" ADD CONSTRAINT "employee_hierarchy_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_hierarchy" ADD CONSTRAINT "employee_hierarchy_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_hierarchy" ADD CONSTRAINT "department_hierarchy_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_hierarchy" ADD CONSTRAINT "department_hierarchy_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_hierarchy" ADD CONSTRAINT "department_hierarchy_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Template-derived role keys are unique within a company (custom roles have no key)
CREATE UNIQUE INDEX "roles_company_id_key_key" ON "roles"("company_id", "key") WHERE "key" IS NOT NULL AND "company_id" IS NOT NULL;
