-- IT Admin (IT heads) may post announcements to everyone: give it to the
-- companies' existing "IT Admin" roles too (new companies get it from the template)
INSERT INTO "role_permissions" ("role_id", "permission_id", "scope")
SELECT r."id", p."id", NULL
FROM "roles" r
JOIN "permissions" p ON p."key" = 'announcement.post'
WHERE r."key" = 'it_admin' AND r."company_id" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "roles" SET "version" = "version" + 1 WHERE "key" = 'it_admin' AND "company_id" IS NOT NULL;
