---
name: admin-forms-design
description: Administration (users/roles/access explorer) + popup-form kit BUILT 2026-10-06 (uncommitted)
metadata:
  node_type: memory
  type: project
  originSessionId: 41fd222d-2689-474c-832d-bb4df9eed381
  modified: 2026-10-06T04:41:28.231Z
---

The Administration section and the popup-form kit were designed (14 canvas boards, `docs/design/builders/build-admin.js`, note n23) and then BUILT on 2026-10-06. Nothing is committed yet.

User's answers:
- The person drawer shows only the last sign-in (no device list).
- All 5 role templates: Recruiter, Payroll officer, Office admin, Auditor (view only), Intern.
- "Preview as" is a read-only link to the Access explorer, never impersonation.
- Role colours are automatic.
- Popup fixes go to all forms.

**Shared form kit**
- `components/ui/modal.tsx`:
  - always fits the screen
  - sizes sm / md / lg
  - icon tone worked out from the lucide icon name
  - bottom sheet on phones
  - "Discard your changes?" check (`guard` prop)
  - Ctrl+Enter presses the last footer button
  - a ✓ when it closes right after saving
- `components/ui/pickers.tsx`: `SearchSelect`, `PersonSelect`, `DateInput`. These have no portal, and Escape closes only the list (`data-picker-open`).
- `FormError` lives in `field.tsx`.
- 36 date fields now use `DateInput`, about 16 people dropdowns use `PersonSelect`, and 20 files use `FormError`.

**API**
- `/company/users`: `insights`, `bulk`, `invite-many`, `:id/roles/preview`, `:id/history`.
- Roles list adds `modules`, `sensitiveCount` and `holders`; `GET /company/roles/templates` (`EXTRA_ROLE_TEMPLATES` in `catalog.ts`).
- `explain/users` adds `reach`; new `GET /access/explain/sensitive`.
- Tests: e2e `admin-plus` (37 checks) and `role-templates.spec.ts`.

**Web**
- `components/admin/`: `role-look.tsx`, `invite-dialog.tsx`, `user-drawer.tsx`.
- Rewritten pages: users, roles, `roles/[id]`, access-explorer. New page: `roles/compare`.

**Why:** the user asked to build this after answering the design questions.
**How to apply:** when committing, include these files. Old forms may still have hand-made error boxes such as `move-dialog` and `auth-forms`. Related: [[everyone-is-employee]].
