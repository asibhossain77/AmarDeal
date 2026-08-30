---
Task ID: 1
Agent: Main
Task: Add admin disable seller account feature

Work Log:
- Read all relevant files: store.ts, schema.prisma, seller-apply-dialog.tsx, seller-apps-tab.tsx, admin API routes, i18n files
- Confirmed seller dashboard already exists with full business profile + product management
- Updated PATCH /api/admin/seller-applications/[id] to handle disabled/enabled statuses
- Updated GET /api/admin/seller-applications to include isSeller from user
- Updated seller-apps-tab.tsx with Disable button (for approved) and Re-enable button (for disabled), plus disable confirmation dialog
- Updated seller-apply-dialog.tsx to handle disabled application status (shows orange banner with re-apply option)
- Added 11 new i18n keys to both bn.ts and en.ts

Stage Summary:
- Admin can now disable an approved seller (sets isSeller=false, status=disabled)
- Admin can re-enable a disabled seller (sets isSeller=true, status=approved)
- Disabled seller sees orange banner and can re-apply
- All new states have proper badges, buttons, confirmation dialogs, and i18n
