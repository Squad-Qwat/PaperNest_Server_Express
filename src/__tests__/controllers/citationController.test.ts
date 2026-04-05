import { Request, Response, NextFunction } from 'express';
import * as citationController from '../../controllers/citationController';
import citationRepository from '../../repositories/citationRepository';
import { mockCitation, mockCitations } from '../../tests/fixtures';
import { mockRequest, mockResponse, mockNext } from '../../tests/mocks/express.mocks';
import { NotFoundError } from '../../utils/errorTypes';

// Mock dependencies
jest.mock('../../repositories/citationRepository');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('CitationController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
    next = mockNext();
  });

  describe('createCitation', () => {
    it('should create a citation successfully', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123' },
        body: {
          type: 'article-journal',
          title: 'Test Article',
          author: 'Smith, J.',
          year: '2023',
          cslJson: {},
        },
      });

      (citationRepository.create as jest.Mock).mockResolvedValue(mockCitation);

      await citationController.createCitation(req as Request, res as Response, next);

      expect(citationRepository.create).toHaveBeenCalledWith({
        documentId: 'doc-123',
        type: 'article-journal',
        title: 'Test Article',
        author: 'Smith, J.',
        year: '2023',
        cslJson: {},
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citation created successfully',
        data: { citation: mockCitation },
      });
    });
  });

  describe('getDocumentCitations', () => {
    it('should get all citations for a document', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123' },
        query: {},
      });

      (citationRepository.findByDocument as jest.Mock).mockResolvedValue(mockCitations);

      await citationController.getDocumentCitations(req as Request, res as Response, next);

      expect(citationRepository.findByDocument).toHaveBeenCalledWith('doc-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citations retrieved successfully',
        data: { citations: mockCitations, count: mockCitations.length },
      });
    });

    it('should filter citations by type when type query param provided', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123' },
        query: { type: 'article-journal' },
      });

      const filteredCitations = [mockCitations[0]];
      (citationRepository.findByType as jest.Mock).mockResolvedValue(filteredCitations);

      await citationController.getDocumentCitations(req as Request, res as Response, next);

      expect(citationRepository.findByType).toHaveBeenCalledWith('doc-123', 'article-journal');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citations retrieved successfully',
        data: { citations: filteredCitations, count: 1 },
      });
    });
  });

  describe('getCitationById', () => {
    it('should get citation by id successfully', async () => {
      req = mockRequest({
        params: { citationId: 'citation-123' },
      });

      (citationRepository.findById as jest.Mock).mockResolvedValue(mockCitation);

      await citationController.getCitationById(req as Request, res as Response, next);

      expect(citationRepository.findById).toHaveBeenCalledWith('citation-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citation retrieved successfully',
        data: { citation: mockCitation },
      });
    });

    it('should throw NotFoundError when citation does not exist', async () => {
      req = mockRequest({
        params: { citationId: 'non-existent' },
      });

      (citationRepository.findById as jest.Mock).mockResolvedValue(null);

      citationController.getCitationById(req as Request, res as Response, next);

      await new Promise(resolve => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('updateCitation', () => {
    it('should update citation successfully', async () => {
      req = mockRequest({
        params: { citationId: 'citation-123' },
        body: { title: 'Updated Title' },
      });

      const updatedCitation = { ...mockCitation, title: 'Updated Title' };
      (citationRepository.update as jest.Mock).mockResolvedValue(updatedCitation);

      await citationController.updateCitation(req as Request, res as Response, next);

      expect(citationRepository.update).toHaveBeenCalledWith('citation-123', {
        title: 'Updated Title',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citation updated successfully',
        data: { citation: updatedCitation },
      });
    });
  });

  describe('deleteCitation', () => {
    it('should delete citation successfully', async () => {
      req = mockRequest({
        params: { citationId: 'citation-123' },
      });

      (citationRepository.delete as jest.Mock).mockResolvedValue(undefined);

      await citationController.deleteCitation(req as Request, res as Response, next);

      expect(citationRepository.delete).toHaveBeenCalledWith('citation-123');
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('searchCitations', () => {
    it('should search citations by title and author', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123' },
        query: { q: 'machine learning' },
      });

      const searchResults = [mockCitation];
      (citationRepository.search as jest.Mock).mockResolvedValue(searchResults);

      await citationController.searchCitations(req as Request, res as Response, next);

      expect(citationRepository.search).toHaveBeenCalledWith('doc-123', 'machine learning');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCitationByDOI', () => {
    it('should find citation by DOI successfully', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123', doi: '10.1234/example' },
      });

      (citationRepository.findByDoi as jest.Mock).mockResolvedValue(mockCitation);

      await citationController.getCitationByDOI(req as Request, res as Response, next);

      expect(citationRepository.findByDoi).toHaveBeenCalledWith('doc-123', '10.1234/example');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Citation retrieved successfully',
        data: { citation: mockCitation },
        meta: undefined,
      });
    });

    it('should throw NotFoundError when DOI not found', async () => {
      req = mockRequest({
        params: { documentId: 'doc-123', doi: 'non-existent-doi' },
      });

      (citationRepository.findByDoi as jest.Mock).mockResolvedValue(null);

      citationController.getCitationByDOI(req as Request, res as Response, next);

      // Wait for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });
});
