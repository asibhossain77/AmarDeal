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
