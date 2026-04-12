import { StorageService } from '../../StorageService'
import { extractPDFChunks } from './pdf.extractor'
import ragRepository from './rag.repository'
import { Readable } from 'stream'

/**
 * RAG Service for handling PDF indexing and retrieval
 */
export class RAGService {
    /**
     * Index a PDF file from R2
     */
    async indexPDF(documentId: string, fileKey: string): Promise<void> {
        console.log(`[RAGService] Starting index for document ${documentId}, file ${fileKey}`)
        
        try {
            // 1. Fetch from R2
            const response = await StorageService.getObject(fileKey)
            
            if (!response.Body) {
                throw new Error('Retrieved empty body from storage')
            }

            // 2. Convert stream to buffer
            const buffer = await this.streamToBuffer(response.Body as Readable)

            // 3. Extract chunks
            const chunks = await extractPDFChunks(buffer)

            // 4. Save to Repository
            await ragRepository.saveChunks(documentId, fileKey, chunks)
            
            console.log(`[RAGService] Indexing complete for ${fileKey}`)
        } catch (error) {
            console.error(`[RAGService] Indexing failed for ${fileKey}:`, error)
            throw error
        }
    }

    /**
     * Helper to read stream into Buffer
     */
    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: any[] = []
            stream.on('data', (chunk) => chunks.push(chunk))
            stream.on('error', reject)
            stream.on('end', () => resolve(Buffer.concat(chunks)))
        })
    }

    /**
     * Search relevant chunks across all indexed PDFs for a document
     */
    async search(documentId: string, query: string, limit: number = 5) {
        return await ragRepository.search(documentId, query, limit)
    }
}

export const ragService = new RAGService()
