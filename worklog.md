---
Task ID: 2b
Agent: Size Fix Agent
Task: Fix LoadingAnimation sizes - section loaders should be md/lg not sm

Work Log:
- Checked all 34 files containing LoadingAnimation usages
- Identified 26 loaders with incorrect sizes across 20 files
- Applied sizing rules: sm (inline/button/absolute), md (centered section py-8–15), lg (page-level py-16+ / min-h-screen)
- Verified all remaining sm usages are correctly in button/inline/absolute contexts

Files fixed (sm → lg, py-16+ page-level loaders):
1. src/components/dashboard/my-deals-panel.tsx (py-16)
2. src/components/dashboard/payout-accounts-panel.tsx (py-16)
3. src/components/dashboard/deal-workflow-tracker.tsx (py-20)
4. src/components/admin/payment-methods-panel.tsx (py-16)
5. src/components/admin/blog-panel.tsx (py-16)
6. src/components/seller/seller-main.tsx (py-16)
7. src/components/seller/seller-deal-tracker.tsx (py-20)
8. src/components/landing/review-section.tsx (py-16)
9. src/components/landing/blog-view.tsx (py-16, py-20)

Files fixed (md → lg, py-16+ already-md loaders):
10. src/components/admin/contract-panel.tsx (py-20)
11. src/components/admin/contact-info-panel.tsx (py-20)
12. src/components/admin/ai-prompt-panel.tsx (py-20)
13. src/components/landing/contract-section.tsx (py-20)
14. src/components/landing/contact-section.tsx (py-20)
15. src/app/contact/contact-page-client.tsx (min-h-screen)

Files fixed (sm → md, centered section py-8–15 loaders):
16. src/components/dashboard/deal-chat-view.tsx (h-full centered)
17. src/components/dashboard/dashboard-review-panel.tsx (py-12, py-10)
18. src/components/admin/admin-main.tsx (py-10)
19. src/components/admin/fee-rules-panel.tsx (py-12)
20. src/components/admin/email-settings-panel.tsx (py-8 ×3)
21. src/components/admin/google-oauth-panel.tsx (py-8)
22. src/components/admin/piprapay-panel.tsx (py-8)

Files with no changes needed (all sm usages correctly in buttons/inline/absolute):
- src/components/dashboard/affiliate-panel.tsx
- src/components/dashboard/profile-panel.tsx
- src/components/dashboard/settings-panel.tsx
- src/components/dashboard/new-deal-form.tsx
- src/components/admin/admin-payouts-panel.tsx
- src/components/admin/admin-profile-panel.tsx
- src/components/admin/two-factor-panel.tsx
- src/components/auth/auth-view.tsx
- src/components/live-support-button.tsx

Stage Summary:
- 20 files fixed with 26 individual LoadingAnimation size corrections
- Section-level loaders now use size="md" (py-8–15) or size="lg" (py-16+)
- Inline/button loaders keep size="sm" (71 remaining, all verified correct)
