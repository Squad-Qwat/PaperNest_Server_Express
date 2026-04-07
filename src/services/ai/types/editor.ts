/**
 * Editor Types for AI Agent Integration
 *
 * Shared TypeScript types for document context, cursor navigation,
 * and editor operations. Follows clean architecture principles.
 *
 * @module lib/ai/types/editor
 */

// ============================================================================
// Document Structure Types
// ============================================================================

/**
 * Represents a section/heading in the document
 */
export interface Section {
    /** Section name/title */
    name: string
    /** Heading level (1-4) or 0 for pseudo-headings */
    level: number
    /** Type: 'heading' for proper headings, 'bold-paragraph' for fake headings */
    type: 'heading' | 'bold-paragraph'
    /** Start position in document */
    startPos: number
    /** End position in document (start of next section or end of doc) */
    endPos: number
    /** Node index in document content array */
    nodeIndex: number
}

/**
 * Represents table information
 */
export interface TableInfo {
    /** 1-based index of this table in the document */
    index: number
    /** Number of rows */
    rows: number
    /** Number of columns */
    cols: number
    /** Start position in document */
    startPos: number
    /** End position in document */
    endPos: number
    /** Text preview of table content */
    contentPreview: string
    /** Whether the table has a header row */
    hasHeader: boolean
}

/**
 * Represents list information
 */
export interface ListInfo {
    /** Type of list */
    type: 'bulletList' | 'orderedList' | 'taskList'
    /** Number of items */
    itemCount: number
    /** Start position in document */
    startPos: number
    /** End position in document */
    endPos: number
    /** Text preview of first items */
    preview: string
}

/**
 * Represents image/media information
 */
export interface ImageInfo {
    /** Image source URL */
    src: string
    /** Alt text */
    alt: string
    /** Position in document */
    position: number
}

// ============================================================================
// Document Context Types
// ============================================================================

/**
 * Document structure overview
 */
export interface DocumentStructure {
    /** All sections/headings in order */
    sections: Section[]
    /** All tables */
    tables: TableInfo[]
    /** All lists */
    lists: ListInfo[]
    /** All images */
    images: ImageInfo[]
}

/**
 * Information about current cursor position
 */
export interface CursorContext {
    /** Absolute position in document */
    position: number
    /** Selection end position (same as position if no selection) */
    selectionEnd: number
    /** Whether there's an active selection */
    hasSelection: boolean
    /** Selected text content (if any) */
    selectedText: string
    /** Current element type at cursor (e.g., 'paragraph', 'heading', 'tableCell') */
    inElement: string
    /** Full hierarchy from cursor to root (optional - mainly for ProseMirror editors) */
    elementHierarchy?: string[]
    /** Name of the containing section (if any) */
    nearestSection: string | null
    /** Text before cursor (limited) */
    textBefore: string
    /** Text after cursor (limited) */
    textAfter: string
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
    /** Total word count */
    wordCount: number
    /** Total character count */
    charCount: number
    /** Number of sections/headings */
    sectionCount: number
    /** Total document nodes */
    nodeCount: number
    /** Whether document needs chunking for AI processing */
    needsChunking: boolean
    /** Estimated reading time in minutes */
    readingTimeMinutes: number
}

/**
 * Complete document context for AI agent
 */
export interface DocumentContext {
    /** Document structure tree */
    structure: DocumentStructure
    /** Current cursor context */
    cursor: CursorContext
    /** Document metadata */
    metadata: DocumentMetadata
    /** Full text content (may be truncated for large docs) */
    textContent: string
    /** Timestamp when context was built */
    timestamp: Date
}

// ============================================================================
// Cursor Navigation Types
// ============================================================================

/**
 * Target types for cursor positioning
 */
export type CursorTarget =
    | 'start'
    | 'end'
    | 'line_start'
    | 'line_end'
    | 'left'
    | 'right'
    | 'up'
    | 'down'
    | `after:${string}`
    | `before:${string}`

/**
 * Element types that can be navigated to
 */
export type NavigableElement =
    | 'heading'
    | 'paragraph'
    | 'table'
    | 'list'
    | 'image'
    | 'codeBlock'
    | 'blockquote'

/**
 * Direction for relative movement
 */
export type MoveDirection = 'forward' | 'backward'

/**
 * Unit types for relative cursor movement
 */
export type MoveUnit = 'character' | 'word' | 'line' | 'paragraph' | 'section' | 'block'

/**
 * Options for move_to_section tool
 */
export interface MoveToSectionOptions {
    /** Section name to move to (fuzzy match supported) */
    sectionName: string
    /** Where to position cursor relative to section */
    position: 'start' | 'end' | 'after_heading'
}

/**
 * Options for move_to_element tool
 */
export interface MoveToElementOptions {
    /** Type of element to navigate to */
    elementType: NavigableElement
    /** 1-based index of the element (defaults to 1) */
    index?: number
    /** Where to position cursor relative to element */
    position?: 'start' | 'end' | 'inside'
}

/**
 * Options for move_relative tool
 */
export interface MoveRelativeOptions {
    /** Direction to move */
    direction: MoveDirection
    /** Number of units to move */
    units: number
    /** Type of unit */
    unitType: MoveUnit
}

/**
 * Options for select_block tool
 */
export interface SelectBlockOptions {
    /** Type of block to select */
    blockType: 'paragraph' | 'section' | 'list' | 'table' | 'current'
}

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Standard result from cursor/navigation tools
 */
export interface NavigationResult {
    success: boolean
    message: string
    newPosition?: number
    previousPosition?: number
}

/**
 * Detailed position information result
 */
export interface PositionInfoResult {
    absolutePosition: number
    percentageThrough: string
    currentNode: {
        type: string
        content: string
        marks: string[]
    }
    parentChain: string[]
    sectionContext: {
        name: string | null
        startPos: number
        endPos: number
    } | null
    canMove: {
        up: boolean
        down: boolean
        left: boolean
        right: boolean
    }
}

// ============================================================================
// Editor Context Builder Type
// ============================================================================

/**
 * Options for building document context
 */
export interface ContextBuildOptions {
    /** Maximum characters to include in textContent */
    maxContentLength?: number
    /** Characters of context before/after cursor */
    cursorContextRadius?: number
    /** Include full structure analysis */
    includeStructure?: boolean
}

/**
 * Function signature for context builder
 */
export type ContextBuilder = (
    editor: any,
    options?: ContextBuildOptions
) => DocumentContext
