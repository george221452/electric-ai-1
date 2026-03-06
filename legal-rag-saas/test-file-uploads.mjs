#!/usr/bin/env node
/**
 * Test script for document upload functionality
 * Tests all supported file formats: PDF, TXT, DOCX, ODT
 */

import { createWriteStream, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api/documents';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'test-workspace';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create test files directory
const TEST_DIR = join(__dirname, 'test-files');
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

// Create a simple TXT file
function createTXTFile() {
  const content = `Acesta este un document de test pentru platforma Legal RAG.

CAPITOLUL I
Dispoziții generale

Art. 1. Prezentul document are scopul de a testa funcționalitatea de încărcare și procesare a fișierelor text.

Art. 2. Sistemul trebuie să poată procesa documente în limba română, inclusiv cu diacritice: ă â î ș ț.

Art. 3. Protecția la electrocutare este esențială în instalațiile electrice.

CAPITOLUL II
Măsuri de siguranță

Art. 4. Toate instalațiile electrice trebuie să fie protejate împotriva supratensiunilor.

Art. 5. Împământarea este obligatorie pentru toate instalațiile de joasă tensiune.

Acesta este sfârșitul documentului de test.`;

  const filePath = join(TEST_DIR, 'test-document.txt');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// Create a minimal valid PDF file
function createPDFFile() {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
100 700 Td
(Document de test pentru Legal RAG) Tj
0 -20 Td
(CAPITOLUL I - Dispozitii generale) Tj
0 -20 Td
(Art. 1. Prezentul document testeaza procesarea PDF.) Tj
0 -20 Td
(Art. 2. Sistemul trebuie sa proceseze diacritice: a a i s t.) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000400 00000 n 

trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
650
%%EOF`;

  const filePath = join(TEST_DIR, 'test-document.pdf');
  writeFileSync(filePath, pdfContent, 'utf-8');
  return filePath;
}

// Create a minimal DOCX file (ZIP with XML)
// Note: This is a simplified test - real DOCX requires proper ZIP structure
function createDOCXFile() {
  // DOCX files are ZIP archives - we'll create a minimal one
  // For this test, we'll use adm-zip if available, or create a simple mock
  const filePath = join(TEST_DIR, 'test-document.docx');
  
  // Minimal DOCX structure using Node.js built-ins would be complex
  // Instead, we'll create a file with the right signature for testing
  // The actual DOCX extraction will fail, but the upload should work
  
  // DOCX starts with PK (ZIP signature)
  const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  const mockContent = Buffer.concat([
    zipSignature,
    Buffer.from('PK mock content for DOCX test')
  ]);
  
  writeFileSync(filePath, mockContent);
  return filePath;
}

// Create a minimal ODT file (also a ZIP)
function createODTFile() {
  const filePath = join(TEST_DIR, 'test-document.odt');
  
  // ODT starts with PK (ZIP signature)
  const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
  const mockContent = Buffer.concat([
    zipSignature,
    Buffer.from('PK mock content for ODT test')
  ]);
  
  writeFileSync(filePath, mockContent);
  return filePath;
}

// Upload a file to the API
async function uploadFile(filePath, fileName, mimeType) {
  const fileBuffer = (await import('fs')).readFileSync(filePath);
  
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);
  formData.append('workspaceId', WORKSPACE_ID);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test a single file type
async function testFileType(name, filePath, mimeType) {
  log(`\nTesting ${name} upload...`, 'blue');
  log(`  File: ${filePath}`, 'reset');
  
  const result = await uploadFile(filePath, name, mimeType);
  
  if (result.success) {
    log(`  ✓ SUCCESS - Status: ${result.status}`, 'green');
    if (result.data?.data?.document) {
      log(`  Document ID: ${result.data.data.document.id}`, 'reset');
      log(`  Status: ${result.data.data.document.status}`, 'reset');
    }
    return true;
  } else {
    log(`  ✗ FAILED - Status: ${result.status || 'N/A'}`, 'red');
    if (result.data?.error) {
      log(`  Error: ${result.data.error}`, 'red');
    }
    if (result.data?.message) {
      log(`  Message: ${result.data.message}`, 'red');
    }
    if (result.error) {
      log(`  Fetch Error: ${result.error}`, 'red');
    }
    return false;
  }
}

// Main test function
async function runTests() {
  log('='.repeat(60), 'blue');
  log('Legal RAG Document Upload Test Suite', 'blue');
  log('='.repeat(60), 'blue');
  log(`API URL: ${API_URL}`, 'reset');
  log(`Workspace ID: ${WORKSPACE_ID}`, 'reset');
  
  // Create test files
  log('\nCreating test files...', 'yellow');
  const testFiles = [
    { name: 'TXT', path: createTXTFile(), mimeType: 'text/plain' },
    { name: 'PDF', path: createPDFFile(), mimeType: 'application/pdf' },
    { name: 'DOCX', path: createDOCXFile(), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'ODT', path: createODTFile(), mimeType: 'application/vnd.oasis.opendocument.text' },
  ];
  log('Test files created successfully!', 'green');
  
  // Run tests
  const results = [];
  
  for (const file of testFiles) {
    const success = await testFileType(file.name, file.path, file.mimeType);
    results.push({ type: file.name, success });
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('Test Summary', 'blue');
  log('='.repeat(60), 'blue');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  for (const result of results) {
    const icon = result.success ? '✓' : '✗';
    const color = result.success ? 'green' : 'red';
    log(`${icon} ${result.type}: ${result.success ? 'PASSED' : 'FAILED'}`, color);
  }
  
  log('\n' + '-'.repeat(60), 'reset');
  log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`, passed === results.length ? 'green' : 'yellow');
  
  // Cleanup
  log('\nCleaning up test files...', 'yellow');
  try {
    const { rmSync } = await import('fs');
    rmSync(TEST_DIR, { recursive: true, force: true });
    log('Cleanup complete!', 'green');
  } catch (e) {
    log(`Cleanup warning: ${e.message}`, 'yellow');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
