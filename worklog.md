---
Task ID: 3
Agent: Main
Task: Cloudflare R2 image upload for product images

Work Log:
- Added R2 credentials to .env file (Account ID, Access Key, Secret, Bucket, Public URL)
- Installed @aws-sdk/client-s3 package
- Created src/lib/r2.ts reusable R2 upload utility with file type/size validation, products/ prefix
- Created src/app/api/upload/product-image/route.ts API (seller-only, auth required, 2MB max, JPEG/PNG/WebP/GIF)
- Added 5 new i18n keys (uploadImage, uploading, dragDrop, maxSize, orUrl) to bn.ts and en.ts
- Updated marketplace AddProductDialog: added ImageUploader component with drag-and-drop, file picker, preview with remove, URL fallback
- Updated seller dashboard AddProductPanel: same ImageUploader with drag-and-drop, preview, URL fallback
- Verified marketplace page renders correctly with zero errors

Stage Summary:
- R2 upload working via /api/upload/product-image
- Files stored in products/ prefix with timestamp-random filename
- Both marketplace dialog and seller dashboard support file upload
- Drag-and-drop + click-to-browse + URL paste all supported
- Preview with remove button shown after upload

---
Task ID: 4
Agent: Main
Task: Turso database connection check and git push

Work Log:
- Verified project already has Turso support in src/lib/db.ts (auto-detects libsql:// URLs)
- Updated .env: DATABASE_URL changed from local SQLite to libsql://amardeal-asibhossain77.aws-ap-south-1.turso.io
- Added TURSO_AUTH_TOKEN to .env with provided JWT token
- Tested Turso connection with libsql client - connection successful
- Verified all 20 tables exist on Turso (User, Deal, DigitalProduct, SellerApplication, etc.)
- Checked data: 81 users, 5 deals, 1 seller application, 2 payment methods, 34 platform settings
- Pushed 4 pending commits to origin/main (987370f..1f5de9c)

Stage Summary:
- Turso database connected and verified - all tables present with live data
- Git push successful to https://github.com/asibhossain77/AmarDeal.git

---
Task ID: 5
Agent: Main
Task: Debug why uploaded profile images don't show on website

Work Log:
- Investigated the full upload flow: r2.ts → upload API → DB save → frontend display
- Tested R2 upload directly: upload succeeds, URL is correct (https://cdn.midman.bd/profiles/...), image is publicly accessible (HTTP 200, content-type: image/png)
- Found root cause: If R2_PUBLIC_URL env var is missing on Vercel, old code silently constructed a non-public S3 endpoint URL (https://xxx.r2.cloudflarestorage.com/bucket/key) which returns 401
- Fixed r2.ts: Added assertR2Configured() and made uploadToR2() throw a clear error if R2_PUBLIC_URL is not set
- Added console.error logging throughout upload APIs (profile-image, admin upload-profile-pic) to trace: file info, old imageLink, R2 result URL, DB save result
- Fixed image onError handlers in profile-panel.tsx and dashboard-sidebar.tsx: replaced display:none with proper state-based fallback (shows letter avatar when image fails to load)
- Added useEffect to reset imgError state when image URL changes (important after upload)
- Verified R2 upload works correctly locally with correct URL generation and public accessibility

Stage Summary:
- Key fix: R2 upload now throws explicit error if R2_PUBLIC_URL is not set, instead of silently returning broken URL
- Image display now shows proper fallback (letter avatar) when image fails to load
- All upload APIs have detailed error logging for Vercel debugging
- User needs to verify R2_PUBLIC_URL=https://cdn.midman.bd is set on Vercel environment variables
