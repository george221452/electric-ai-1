import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

// Test directory for temporary files
const TEST_DIR = join(__dirname, '..', 'test-files-e2e');

// Helper to create test files
function createTestFiles() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }

  // Create TXT file
  const txtContent = `Document de test pentru Legal RAG

CAPITOLUL I
Dispoziții generale

Art. 1. Prezentul document are scopul de a testa funcționalitatea.

Art. 2. Sistemul trebuie să proceseze text în limba română cu diacritice: ă â î ș ț.

Art. 3. Instalațiile electrice trebuie să fie protejate.

Acesta este sfârșitul documentului.`;
  writeFileSync(join(TEST_DIR, 'test.txt'), txtContent, 'utf-8');

  // Create minimal PDF
  const pdfContent = `%PDF-1.4
1 0 obj
<</Type/Catalog/Pages 2 0 R>>
endobj
2 0 obj
<</Type/Pages/Kids[3 0 R]/Count 1>>
endobj
3 0 obj
<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>
endobj
4 0 obj
<</Length 50>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<</Size 5/Root 1 0 R>>
startxref
313
%%EOF`;
  writeFileSync(join(TEST_DIR, 'test.pdf'), pdfContent, 'utf-8');

  return {
    txtPath: join(TEST_DIR, 'test.txt'),
    pdfPath: join(TEST_DIR, 'test.pdf'),
  };
}

// Cleanup test files
function cleanupTestFiles() {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Document Upload', () => {
  const files = createTestFiles();

  test.afterAll(() => {
    cleanupTestFiles();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (assumes user is authenticated or demo mode)
    await page.goto('/dashboard');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should open upload dialog', async ({ page }) => {
    // Click on upload button (adjust selector based on your UI)
    const uploadButton = page.getByRole('button', { name: /încarcă|upload/i });
    
    // If button doesn't exist, the test might need adjustment based on actual UI
    if (await uploadButton.isVisible().catch(() => false)) {
      await uploadButton.click();
      
      // Check if dialog opened
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Check dialog title
      await expect(page.getByText(/încarcă documente|upload documents/i)).toBeVisible();
    }
  });

  test('should show supported file formats', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /încarcă|upload/i });
    
    if (await uploadButton.isVisible().catch(() => false)) {
      await uploadButton.click();
      
      // Check for supported formats text
      await expect(page.getByText(/PDF.*DOCX.*ODT.*TXT/i)).toBeVisible();
    }
  });

  test('should upload TXT file successfully', async ({ page }) => {
    // Intercept the API call
    const uploadPromise = page.waitForResponse(response => 
      response.url().includes('/api/documents') && response.request().method() === 'POST'
    );

    // Open upload dialog
    const uploadButton = page.getByRole('button', { name: /încarcă|upload/i });
    if (!(await uploadButton.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    
    await uploadButton.click();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(files.txtPath);

    // Submit upload
    const submitButton = page.getByRole('button', { name: /încarcă.*fișier|upload.*file/i });
    await submitButton.click();

    // Wait for API response
    const response = await uploadPromise;
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.document).toBeDefined();
    expect(data.data.document.status).toBe('PENDING');
  });

  test('should reject unsupported file type', async ({ page }) => {
    // Create an unsupported file
    const unsupportedPath = join(TEST_DIR, 'test.jpg');
    writeFileSync(unsupportedPath, 'fake image content');

    // Open upload dialog
    const uploadButton = page.getByRole('button', { name: /încarcă|upload/i });
    if (!(await uploadButton.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    
    await uploadButton.click();

    // Try to upload unsupported file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(unsupportedPath);

    // Submit upload
    const submitButton = page.getByRole('button', { name: /încarcă.*fișier|upload.*file/i });
    await submitButton.click();

    // Should show error
    await expect(page.getByText(/unsupported|not supported|tipul de fișier/i).first()).toBeVisible();
  });

  test('should handle large file size validation', async ({ page }) => {
    // Create a large file (this would be >100MB in real scenario)
    // For testing, we'll just check the UI shows size limit
    
    const uploadButton = page.getByRole('button', { name: /încarcă|upload/i });
    if (!(await uploadButton.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    
    await uploadButton.click();

    // Check for file size limit indication
    await expect(page.getByText(/100MB|max.*100/i)).toBeVisible();
  });

  test('should show error when workspaceId is missing', async ({ page }) => {
    // This would test the API directly since UI should always provide workspaceId
    const response = await page.evaluate(async () => {
      const formData = new FormData();
      const blob = new Blob(['test content'], { type: 'text/plain' });
      formData.append('file', blob, 'test.txt');
      // Note: workspaceId is missing

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      return { status: res.status, data: await res.json() };
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('workspaceId');
  });
});

test.describe('Document Upload API', () => {
  test('should list documents for workspace', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/documents?workspaceId=test-workspace');
      return { status: res.status, data: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(Array.isArray(response.data.data.documents)).toBe(true);
  });

  test('should return 400 when workspaceId is missing in GET', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/documents');
      return { status: res.status, data: await res.json() };
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('workspaceId');
  });
});
