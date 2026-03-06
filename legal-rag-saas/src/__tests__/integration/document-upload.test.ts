import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/documents/route';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}));

jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
    id: 'test-doc-id',
    name: data.data.name,
    fileType: data.data.fileType,
    fileSize: data.data.fileSize,
    storageKey: data.data.storageKey,
    workspaceId: data.data.workspaceId,
    userId: data.data.userId,
    ragConfigId: data.data.ragConfigId,
    status: 'PENDING',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  const mockFindMany = jest.fn().mockResolvedValue([]);
  const mockUpdate = jest.fn().mockImplementation((params) => Promise.resolve({
    id: params.where.id,
    workspaceId: 'test-workspace',
    ...params.data,
  }));
  const mockCreateMany = jest.fn().mockResolvedValue({ count: 2 });
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      document: {
        create: mockCreate,
        findMany: mockFindMany,
        update: mockUpdate,
      },
      paragraph: {
        createMany: mockCreateMany,
      },
      $disconnect: jest.fn(),
    })),
  };
});

jest.mock('@/src/infrastructure/adapters/storage/minio-storage', () => ({
  LocalStorage: jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockResolvedValue('test-key'),
  })),
}));

jest.mock('@/src/infrastructure/adapters/extractors/universal-extractor', () => ({
  UniversalExtractor: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockResolvedValue({
      paragraphs: [
        { content: 'Test paragraph 1', pageNumber: 1, metadata: { paragraphNumber: 1 } },
        { content: 'Test paragraph 2', pageNumber: 1, metadata: { paragraphNumber: 2 } },
      ],
      pageCount: 1,
      metadata: { fileType: 'text/plain' },
    }),
  })),
}));

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getCollections: jest.fn().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@/src/infrastructure/adapters/embedding/embedding-service', () => ({
  OpenAIEmbeddingService: jest.fn().mockImplementation(() => ({
    embedBatch: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  })),
}));

describe('Document Upload API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/documents', () => {
    it('should successfully upload a TXT file', async () => {
      const fileContent = 'Test document content for upload';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.document).toBeDefined();
    });

    it('should return 400 when file is missing', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('File is required');
    });

    it('should return 400 when workspaceId is missing', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('workspaceId is required');
    });

    it('should handle file with generic MIME type', async () => {
      const fileContent = 'Test content';
      // File without proper MIME type
      const file = new File([fileContent], 'test.txt', { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      // Should succeed because extension is used to detect type
      expect(response.status).toBe(201);
    });

    it('should handle PDF file upload', async () => {
      const fileContent = '%PDF-1.4 test pdf content';
      const file = new File([fileContent], 'test.pdf', { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.document.fileType).toBe('application/pdf');
    });

    it('should handle DOCX file upload', async () => {
      const fileContent = 'PK'; // ZIP signature for DOCX
      const file = new File([fileContent], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
    });

    it('should handle ODT file upload', async () => {
      const fileContent = 'PK'; // ZIP signature for ODT
      const file = new File([fileContent], 'test.odt', { 
        type: 'application/vnd.oasis.opendocument.text' 
      });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
    });

    it('should handle file with uppercase extension', async () => {
      const fileContent = 'Test content';
      const file = new File([fileContent], 'TEST.TXT', { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
    });

    it('should handle file with ragConfigId', async () => {
      const fileContent = 'Test content';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', 'test-workspace');
      formData.append('ragConfigId', 'legal-contract');
      
      const request = new NextRequest('http://localhost:3000/api/documents', {
        method: 'POST',
        body: formData,
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/documents', () => {
    it('should list documents for workspace', async () => {
      const request = new NextRequest('http://localhost:3000/api/documents?workspaceId=test-workspace');
      
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.documents).toBeDefined();
    });

    it('should return 400 when workspaceId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/documents');
      
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('workspaceId is required');
    });
  });
});
