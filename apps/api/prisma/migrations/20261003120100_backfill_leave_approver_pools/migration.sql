-- Existing approval levels had a single designated approver; give them a one-person pool.
UPDATE "leave_approvals"
SET "approver_ids" = ARRAY["approver_id"]
WHERE "approver_id" IS NOT NULL AND cardinality("approver_ids") = 0;
