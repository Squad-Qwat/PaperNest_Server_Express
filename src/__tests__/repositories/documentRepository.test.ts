import { DocumentRepository } from '../../repositories/documentRepository';
import { __mockFirestore } from '../../../__mocks__/firebase-admin';
import { mockDocument, mockDocuments } from '../../tests/fixtures';

jest.mock('../../config/firebase', () => ({
  db: require('../../../__mocks__/firebase-admin').__mockFirestore,
}));

describe('DocumentRepository', () => {
  let documentRepository: DocumentRepository;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    documentRepository = new DocumentRepository();
    mockCollection = __mockFirestore.collection('documents');
  });

  describe('create', () => {
    it('should create a new document successfully', async () => {
      const documentData = {
        workspaceId: 'workspace-123',
        title: 'Test Document',
        savedContent: 'Document content',
        currentVersionId: 'version-1',
        createdBy: 'user-123',
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        id: 'doc-123',
        set: jest.fn().mockResolvedValue(undefined),
      });

      const result = await documentRepository.create(documentData);

      expect(result).toMatchObject(documentData);
      expect(result.documentId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockCollection.doc).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return document when found', async () => {
      const documentId = 'doc-123';
      const mockDoc = {
        exists: true,
        data: () => mockDocument,
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await documentRepository.findById(documentId);

      expect(result).toEqual(mockDocument);
    });

    it('should return null when document not found', async () => {
      const documentId = 'non-existent';
      const mockDoc = {
        exists: false,
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await documentRepository.findById(documentId);

      expect(result).toBeNull();
    });
  });

  describe('findByWorkspace', () => {
    it('should return all documents in a workspace', async () => {
      const workspaceId = 'workspace-123';

      mockCollection.where = jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: mockDocuments.map((doc) => ({
              data: () => doc,
            })),
          }),
        }),
      });

      const result = await documentRepository.findByWorkspace(workspaceId);

      expect(result).toEqual(mockDocuments);
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', workspaceId);
    });

    it('should return empty array when no documents found', async () => {
      const workspaceId = 'empty-workspace';

      mockCollection.where = jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        }),
      });

      const result = await documentRepository.findByWorkspace(workspaceId);

      expect(result).toEqual([]);
    });
  });

  describe('searchByTitle', () => {
    it('should return documents matching title search', async () => {
      const workspaceId = 'workspace-123';
      const query = 'research';

      mockCollection.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                empty: false,
                docs: [{ data: () => mockDocument }],
              }),
            }),
          }),
        }),
      });

      const result = await documentRepository.searchByTitle(workspaceId, query);

      expect(result).toEqual([mockDocument]);
    });

    it('should return empty array when no matches found', async () => {
      const workspaceId = 'workspace-123';
      const query = 'nonexistent';

      mockCollection.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                empty: true,
                docs: [],
              }),
            }),
          }),
        }),
      });

      const result = await documentRepository.searchByTitle(workspaceId, query);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update document successfully', async () => {
      const documentId = 'doc-123';
      const updates = { title: 'Updated Title' };

      mockCollection.doc = jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ ...mockDocument, ...updates }),
        }),
      });

      const result = await documentRepository.update(documentId, updates);

      expect(result).toMatchObject(updates);
      expect(mockCollection.doc).toHaveBeenCalledWith(documentId);
    });
  });

  describe('delete', () => {
    it('should delete document successfully', async () => {
      const documentId = 'doc-123';

      mockCollection.doc = jest.fn().mockReturnValue({
        delete: jest.fn().mockResolvedValue(undefined),
      });

      await documentRepository.delete(documentId);

      expect(mockCollection.doc).toHaveBeenCalledWith(documentId);
    });
  });
});
