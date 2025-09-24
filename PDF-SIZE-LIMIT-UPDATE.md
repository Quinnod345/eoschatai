# PDF Upload Size Limit Update

## Summary

The PDF upload size limit has been increased from 5MB to 50MB to support larger documents.

## Changes Made

### 1. Server-side Updates
- **File**: `/app/(chat)/api/files/pdf/route.ts`
  - Updated `MAX_PDF_SIZE` from 5MB to 50MB
  - Added route configuration for handling larger request bodies
  - Added 60-second timeout for processing large PDFs

### 2. Client-side Updates
- **File**: `/components/document-context-modal.tsx`
  - Updated file size validation to allow 50MB for PDFs while keeping 10MB for other file types
  - Updated error messages to reflect the new limits

### 3. Existing Configuration
- The main file upload component (`/components/multimodal-input.tsx`) already had a 50MB limit for all files, so no changes were needed there

## Technical Details

### API Route Configuration
```typescript
// Maximum PDF size (50MB)
const MAX_PDF_SIZE = 50 * 1024 * 1024;

// Configure route to handle larger request bodies
export const maxDuration = 60; // 60 seconds timeout for large PDFs
export const runtime = 'nodejs'; // Use Node.js runtime
```

### File Size Validation
- PDFs: Maximum 50MB
- Other documents (DOC, DOCX, XLS, XLSX, TXT, MD): Maximum 10MB
- General file uploads: Maximum 50MB

## Testing

A test script has been created at `test-large-pdf-upload.mjs` that can generate test PDFs of various sizes:
- 6MB PDF (to verify uploads over the old 5MB limit work)
- 15MB PDF (medium-sized test)
- 45MB PDF (close to the new 50MB limit)

To use the test script:
1. Install pdf-lib if not already installed: `npm install pdf-lib`
2. Run the script: `node test-large-pdf-upload.mjs`
3. Upload the generated test PDFs through the application UI

## Notes

- The 50MB limit should accommodate most typical PDF documents
- Very large PDFs may still take time to process, especially if they contain many pages or complex content
- The 60-second timeout ensures that large PDFs have enough time to be processed
- Consider implementing progress indicators for large file uploads in future updates
