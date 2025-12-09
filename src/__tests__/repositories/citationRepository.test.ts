import { CitationRepository } from '../../repositories/citationRepository';
import { __mockFirestore } from '../../../__mocks__/firebase-admin';
import { mockCitation, mockCitations } from '../../tests/fixtures';

jest.mock('../../config/firebase', () => ({
  db: require('../../../__mocks__/firebase-admin').__mockFirestore,
}));

describe('CitationRepository', () => {
  let citationRepository: CitationRepository;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    citationRepository = new CitationRepository();
    mockCollection = __mockFirestore.collection('citations');
  });

  describe('create', () => {
    it('should create a new citation successfully', async () => {
      const citationData = {
        documentId: 'doc-123',
        type: 'article-journal',
        title: 'Test Article',
        author: 'Smith, J.',
        publicationInfo: 'Journal of Testing, 2023',
        doi: null,
        accessDate: '2024-01-01',
        publicationDate: '2023-12-01',
        url: null,
        cslJson: { type: 'article-journal', title: 'Test Article' },
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        id: 'citation-123',
        set: jest.fn().mockResolvedValue(undefined),
      });

      const result = await citationRepository.create(citationData);

      expect(result).toMatchObject(citationData);
      expect(result.citationId).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockCollection.doc).toHaveBeenCalled();
    });

    it('should include optional doi when provided', async () => {
      const citationData = {
        documentId: 'doc-123',
        type: 'article',
        title: 'Test Article',
        author: 'Smith, J.',
        publicationInfo: 'Journal of Testing, 2023',
        doi: '10.1234/example',
        accessDate: '2024-01-01',
        publicationDate: '2023-12-01',
        url: null,
        cslJson: { type: 'article-journal', title: 'Test Article' },
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        id: 'citation-456',
        set: jest.fn().mockResolvedValue(undefined),
      });

      const result = await citationRepository.create(citationData);

      expect(result.doi).toBe(citationData.doi);
    });
  });

  describe('findById', () => {
    it('should return citation when found', async () => {
      const citationId = 'citation-123';
      const mockDoc = {
        exists: true,
        data: () => mockCitation,
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await citationRepository.findById(citationId);

      expect(result).toEqual(mockCitation);
    });

    it('should return null when citation not found', async () => {
      const citationId = 'non-existent';
      const mockDoc = {
        exists: false,
      };

      mockCollection.doc = jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await citationRepository.findById(citationId);

      expect(result).toBeNull();
    });
  });

  describe('findByDocument', () => {
    it('should return all citations for a document', async () => {
      const documentId = 'doc-123';

      mockCollection.where = jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: mockCitations.map((citation) => ({
              data: () => citation,
            })),
          }),
        }),
      });

      const result = await citationRepository.findByDocument(documentId);

      expect(result).toEqual(mockCitations);
      expect(mockCollection.where).toHaveBeenCalledWith('documentId', '==', documentId);
    });

    it('should return empty array when no citations found', async () => {
      const documentId = 'doc-empty';

      mockCollection.where = jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        }),
      });

      const result = await citationRepository.findByDocument(documentId);

      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return citations filtered by type', async () => {
      const type = 'article';

      mockCollection.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => mockCitation }],
            }),
          }),
        }),
      });

      const result = await citationRepository.findByType('doc-123', type);

      expect(result).toEqual([mockCitation]);
    });
  });

  describe('findByDoi', () => {
    it('should return citation when found by DOI', async () => {
      const documentId = 'doc-123';
      const doi = '10.1234/example.doi';

      mockCollection.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => mockCitation }],
            }),
          }),
        }),
      });

      const result = await citationRepository.findByDoi(documentId, doi);

      expect(result).toEqual(mockCitation);
    });

    it('should return null when citation not found by DOI', async () => {
      const documentId = 'doc-123';
      const doi = 'non-existent-doi';

      mockCollection.where = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: true,
            }),
          }),
        }),
      });

      const result = await citationRepository.findByDoi(documentId, doi);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update citation successfully', async () => {
      const citationId = 'citation-123';
      const updates = { title: 'Updated Title' };

      mockCollection.doc = jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ ...mockCitation, ...updates }),
        }),
      });

      const result = await citationRepository.update(citationId, updates);

      expect(result).toMatchObject(updates);
      expect(mockCollection.doc).toHaveBeenCalledWith(citationId);
    });
  });

  describe('delete', () => {
    it('should delete citation successfully', async () => {
      const citationId = 'citation-123';

      mockCollection.doc = jest.fn().mockReturnValue({
        delete: jest.fn().mockResolvedValue(undefined),
      });

      await citationRepository.delete(citationId);

      expect(mockCollection.doc).toHaveBeenCalledWith(citationId);
    });
  });
});
