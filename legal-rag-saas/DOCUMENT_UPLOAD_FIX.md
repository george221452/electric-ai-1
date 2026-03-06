# Document Upload Fix Documentation

## Problem
Users were experiencing "Internal server error" when trying to upload documents to the platform.

## Root Causes Identified and Fixed

### 1. Improved Error Handling in API Route (`app/api/documents/route.ts`)

**Changes:**
- Added detailed validation for file presence, workspaceId, and file extension
- Added file type detection from extension when MIME type is generic (`application/octet-stream`)
- Added file size validation (100MB limit)
- Added comprehensive error logging with context
- Added proper cleanup of uploaded files if database operation fails
- Wrapped each major operation in try-catch with specific error messages

### 2. Enhanced File Type Detection

**Supported formats:**
- PDF (`application/pdf`)
- TXT (`text/plain`)
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- ODT (`application/vnd.oasis.opendocument.text`)

**Detection logic:**
```typescript
// First, check provided MIME type
// If generic or missing, detect from file extension
// If still unknown, reject with helpful error message
```

### 3. Improved UniversalExtractor (`src/infrastructure/adapters/extractors/universal-extractor.ts`)

**Changes:**
- Added validation for empty file buffers
- Added normalization of MIME types (lowercase, trim)
- Added better error messages with context
- Improved TXT extraction with:
  - UTF-8 and Latin1 encoding fallback
  - Handling of empty files
  - Handling of whitespace-only files
  - Automatic paragraph creation for short content

### 4. Fixed Jest Configuration (`jest.config.js`)

**Changes:**
- Fixed module name mapping for `@/lib/*`, `@/app/*`, `@/components/*`, `@/hooks/*`
- Added explicit mapping for `@/src/*` before generic `@/*`

## Testing

### Unit Tests

Run unit tests for the UniversalExtractor:
```bash
npm test -- --testPathPattern="universal-extractor"
```

Tests cover:
- ✓ Supported file type detection
- ✓ TXT extraction with various content types
- ✓ PDF extraction (valid and invalid)
- ✓ DOCX extraction handling
- ✓ ODT extraction handling
- ✓ Edge cases (empty files, special characters, long lines)
- ✓ Unsupported file type rejection

### Integration Tests

Run integration tests for the document upload API:
```bash
npm test -- --testPathPattern="document-upload"
```

Tests cover:
- ✓ Successful TXT file upload
- ✓ Successful PDF file upload
- ✓ Successful DOCX file upload
- ✓ Successful ODT file upload
- ✓ Missing file validation
- ✓ Missing workspaceId validation
- ✓ Generic MIME type handling
- ✓ Uppercase extension handling
- ✓ Custom RAG config ID handling
- ✓ Document listing API

### Manual Testing Script

Run the manual file upload test:
```bash
# Make sure the dev server is running
npm run dev

# In another terminal, run the test script
node test-file-uploads.mjs
```

This will create test files for all formats and attempt to upload them.

### E2E Tests

Run Playwright E2E tests:
```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
npm run test:e2e

# Or with UI
npm run test:e2e:ui
```

## Error Messages

### Client-Facing Errors (400 Bad Request)
- `"File is required"` - No file provided
- `"workspaceId is required"` - Missing workspace
- `"Invalid file name"` - File has no extension
- `"Unsupported file type"` - File extension not in supported list
- `"File too large"` - File exceeds 100MB limit

### Server Errors (500 Internal Server Error)
- `"Invalid form data"` - Could not parse the request
- `"Failed to read file"` - Buffer conversion failed
- `"Storage error"` - Failed to save to storage
- `"Database error"` - Failed to create database record
- `"Internal server error"` - Unexpected error with details

## Logging

All operations are logged with prefixes for easy filtering:
- `[Documents API]` - Main API operations
- `[Document Processing]` - Async processing operations
- `[Qdrant]` - Vector database operations

## Environment Variables

Ensure these are set for full functionality:
```bash
# Database
DATABASE_URL=postgresql://...

# Qdrant (optional, falls back to localhost)
QDRANT_URL=http://localhost:6333

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...
```

## Monitoring Upload Status

Documents go through these statuses:
1. `PENDING` - Initial upload, waiting for processing
2. `PROCESSING` - Content extraction and indexing
3. `COMPLETED` - Successfully processed
4. `FAILED` - Processing error (check `processingError` field)

## Future Improvements

1. Add file virus scanning
2. Add duplicate file detection
3. Support more formats (RTF, HTML, etc.)
4. Add chunked upload for large files
5. Add progress tracking for processing
6. Add retry mechanism for failed processing
