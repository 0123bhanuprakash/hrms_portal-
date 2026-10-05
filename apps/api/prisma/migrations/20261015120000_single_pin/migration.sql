-- One pinned announcement per company: keep the newest pin
UPDATE "announcements" a SET "pinned" = false
WHERE a."pinned" = true
  AND EXISTS (
    SELECT 1 FROM "announcements" b
    WHERE b."company_id" = a."company_id" AND b."pinned" = true AND b."deleted_at" IS NULL
      AND (b."published_at" > a."published_at" OR (b."published_at" = a."published_at" AND b."id" > a."id"))
  );
