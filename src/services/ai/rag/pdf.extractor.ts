import pdf = require('pdf-parse')

export interface PDFChunk {
    text: string
    pageNumber: number
    chunkIndex: number
}

/**
 * PDF Text Extractor Utility
 * Reads PDF buffer and splits text into manageable chunks for RAG context
 */
export const extractPDFChunks = async (
    buffer: Buffer,
    chunkSize: number = 1000,
    overlap: number = 200
): Promise<PDFChunk[]> => {
    try {
        const pdfCall = pdf as any
        const data = await pdfCall(buffer)
        const fullText = data.text
        
        // Clean text: remove excessive whitespace
        const cleanText = fullText.replace(/\s+/g, ' ').trim()
        
        const chunks: PDFChunk[] = []
        let currentPos = 0
        let index = 0

        while (currentPos < cleanText.length) {
            const end = Math.min(currentPos + chunkSize, cleanText.length)
            const text = cleanText.slice(currentPos, end)
            
            chunks.push({
                text,
                pageNumber: 0, // pdf-parse doesn't easily give page per chunk without more complex logic
                chunkIndex: index
            })

            currentPos += (chunkSize - overlap)
            index++
        }

        console.log(`[PDFExtractor] Extracted ${chunks.length} chunks from PDF`)
        return chunks
    } catch (error) {
        console.error('[PDFExtractor] Error extracting text from PDF:', error)
        throw new Error('Failed to extract text from PDF')
    }
}
