-- CreateTable
CREATE TABLE "system_health_samples" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "services" JSONB NOT NULL,
    "latency" JSONB,

    CONSTRAINT "system_health_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "provider" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "payload" TEXT,
    "retried_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_in_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "user_id" UUID,
    "company_id" UUID,

    CONSTRAINT "sign_in_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_health_samples_at_idx" ON "system_health_samples"("at");

-- CreateIndex
CREATE INDEX "system_events_at_idx" ON "system_events"("at");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- CreateIndex
CREATE INDEX "email_logs_status_created_at_idx" ON "email_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "sign_in_attempts_at_idx" ON "sign_in_attempts"("at");

