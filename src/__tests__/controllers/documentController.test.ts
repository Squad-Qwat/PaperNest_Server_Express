import { Request, Response, NextFunction } from 'express';
import * as documentController from '../../controllers/documentController';
import documentRepository from '../../repositories/documentRepository';
import documentBodyRepository from '../../repositories/documentBodyRepository';
import { mockDocument, mockDocuments, mockDocumentBody } from '../../tests/fixtures';
import { mockAuthRequest, mockResponse, mockNext } from '../../tests/mocks/express.mocks';
import { NotFoundError } from '../../utils/errorTypes';

jest.mock('../../repositories/documentRepository');
jest.mock('../../repositories/documentBodyRepository');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('DocumentController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
    next = mockNext();
  });

  describe('createDocument', () => {
    it('should create a document with initial version successfully', async () => {
      req = mockAuthRequest('user-123', {
        params: { workspaceId: 'workspace-123' },
        body: {
          title: 'New Document',
          content: 'Initial content',
        },
      });

      (documentRepository.create as jest.Mock).mockResolvedValue(mockDocument);
      (documentBodyRepository.create as jest.Mock).mockResolvedValue(mockDocumentBody);
      (documentRepository.updateContent as jest.Mock).mockResolvedValue(mockDocument);

      documentController.createDocument(req as Request, res as Response, next);

      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(next).not.toHaveBeenCalled(); // Should not call next with error
      expect(documentRepository.create).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        title: 'New Document',
        savedContent: 'Initial content',
        currentVersionId: '',
        createdBy: 'user-123',
      });
      expect(documentBodyRepository.create).toHaveBeenCalled();
      expect(documentRepository.updateContent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Document created successfully',
        data: { document: mockDocument, initialVersion: mockDocumentBody },
        meta: undefined,
      });
    });
  });

  describe('getWorkspaceDocuments', () => {
    it('should get all documents in workspace', async () => {
      req = mockAuthRequest('user-123', {
        params: { workspaceId: 'workspace-123' },
      });

      (documentRepository.findByWorkspace as jest.Mock).mockResolvedValue(mockDocuments);

      await documentController.getWorkspaceDocuments(req as Request, res as Response, next);

      expect(documentRepository.findByWorkspace).toHaveBeenCalledWith('workspace-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Documents retrieved successfully',
        data: { documents: mockDocuments, count: mockDocuments.length },
      });
    });
  });

  describe('getDocumentById', () => {
    it('should get document with current version', async () => {
      req = mockAuthRequest('user-123', {
        params: { documentId: 'doc-123' },
      });

      (documentRepository.findById as jest.Mock).mockResolvedValue(mockDocument);
      (documentBodyRepository.findById as jest.Mock).mockResolvedValue(mockDocumentBody);

      documentController.getDocumentById(req as Request, res as Response, next);

      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(next).not.toHaveBeenCalled(); // Should not call next with error
      expect(documentRepository.findById).toHaveBeenCalledWith('doc-123');
      expect(documentBodyRepository.findById).toHaveBeenCalledWith(mockDocument.currentVersionId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Document retrieved successfully',
        data: { document: mockDocument, currentVersion: mockDocumentBody },
        meta: undefined,
      });
    });

    it('should throw NotFoundError when document does not exist', async () => {
      req = mockAuthRequest('user-123', {
        params: { documentId: 'non-existent' },
      });

      (documentRepository.findById as jest.Mock).mockResolvedValue(null);

      documentController.getDocumentById(req as Request, res as Response, next);

      // Wait for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('updateDocument', () => {
    it('should update document title successfully', async () => {
      req = mockAuthRequest('user-123', {
        params: { documentId: 'doc-123' },
        body: { title: 'Updated Title' },
      });

      const updatedDocument = { ...mockDocument, title: 'Updated Title' };
      (documentRepository.update as jest.Mock).mockResolvedValue(updatedDocument);

      await documentController.updateDocument(req as Request, res as Response, next);

      expect(documentRepository.update).toHaveBeenCalledWith('doc-123', {
        title: 'Updated Title',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Document updated successfully',
        data: { document: updatedDocument },
      });
    });
  });

  describe('updateDocumentContent', () => {
    it('should create new version when updating content', async () => {
      req = mockAuthRequest('user-123', {
        params: { documentId: 'doc-123' },
        body: { content: 'Updated content' },
      });

      const newVersion = { ...mockDocumentBody, versionNumber: 2 };
      (documentBodyRepository.getLatestVersionNumber as jest.Mock).mockResolvedValue(1);
      (documentBodyRepository.setAllVersionsNotCurrent as jest.Mock).mockResolvedValue(undefined);
      (documentBodyRepository.create as jest.Mock).mockResolvedValue(newVersion);
      (documentRepository.updateContent as jest.Mock).mockResolvedValue(mockDocument);
      (documentBodyRepository.findById as jest.Mock).mockResolvedValue(newVersion);

      documentController.updateDocumentContent(req as Request, res as Response, next);

      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(next).not.toHaveBeenCalled(); // Should not call next with error
      expect(documentBodyRepository.create).toHaveBeenCalledWith({
        documentId: 'doc-123',
        userId: 'user-123',
        content: 'Updated content',
        message: expect.any(String),
        isCurrentVersion: true,
        versionNumber: expect.any(Number),
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      req = mockAuthRequest('user-123', {
        params: { documentId: 'doc-123' },
      });

      (documentRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await documentController.deleteDocument(req as Request, res as Response, next);

      expect(documentRepository.delete).toHaveBeenCalledWith('doc-123');
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('searchDocuments', () => {
    it('should search documents by title', async () => {
      req = mockAuthRequest('user-123', {
        params: { workspaceId: 'workspace-123' },
        query: { q: 'research' },
      });

      const searchResults = [mockDocument];
      (documentRepository.searchByTitle as jest.Mock).mockResolvedValue(searchResults);

      await documentController.searchDocuments(req as Request, res as Response, next);

      expect(documentRepository.searchByTitle).toHaveBeenCalledWith('workspace-123', 'research');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Documents retrieved successfully',
        data: { documents: searchResults, count: 1 },
        meta: undefined,
      });
    });
  });

  describe('getUserDocuments', () => {
    it('should get all documents for a user across workspaces', async () => {
      req = mockAuthRequest('user-123');

      (documentRepository.findByCreator as jest.Mock).mockResolvedValue(mockDocuments);

      await documentController.getUserDocuments(req as Request, res as Response, next);

      expect(documentRepository.findByCreator).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
