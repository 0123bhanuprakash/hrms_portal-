-- "That helped" counts each person once per help topic
CREATE TABLE "ticket_category_helps" (
    "category_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_category_helps_pkey" PRIMARY KEY ("category_id","user_id")
);

ALTER TABLE "ticket_category_helps" ADD CONSTRAINT "ticket_category_helps_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
