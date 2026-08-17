/**
 * Shared types for the RAG ingest pipeline.
 *
 * Pipeline stages, each writing to .cache/rag/ so any stage can be re-run alone:
 *   1. extract.ts  data/**            -> .cache/rag/text/*.json   (ExtractedDoc)
 *   2. ocr.ts      scanned PDFs       -> .cache/rag/text/*.json   (fills pages in place)
 *   3. manifest.ts .cache/rag/text/*  -> data/manifest.json       (ManifestEntry[])
 *   4. chunk.ts    text + manifest    -> .cache/rag/chunks.json   (Chunk[])
 *   5. index.ts    chunks             -> MongoDB Atlas (ragchunks + vector index)
 */

/** Classification drives chunking strategy and citation wording. */
export type DocType =
  | 'van_ban_phap_quy' // Nghị định, Thông tư, Quyết định — split on Điều/Chương
  | 'de_an_tuyen_sinh' // School admission schemes — split on section headings
  | 'chuong_trinh_stem' // STEM programme documents
  | 'unknown'

export type SourceFormat = 'pdf_text' | 'pdf_scan' | 'docx'

/**
 * One page of extracted text.
 * `num` is the real 1-based PDF page number, used verbatim in citations.
 * DOCX has no pagination, so `num` is null there and citations fall back to
 * the section path instead of a page number.
 */
export interface ExtractedPage {
  num: number | null
  text: string
}

/** Output of stage 1 (and stage 2 for scans). One file per source document. */
export interface ExtractedDoc {
  /** Path relative to data/, e.g. "APP_23 Truong/14. USTH.pdf" */
  file: string
  /** SHA-256 of the raw bytes — the dedupe key. Filenames are unreliable. */
  sha256: string
  format: SourceFormat
  /** True until OCR has filled in `pages`. Scanned PDFs start true. */
  needsOcr: boolean
  pageCount: number
  pages: ExtractedPage[]
  extractedAt: string
}

/**
 * Curated metadata, one entry per deduped document.
 *
 * Bootstrapped by manifest.ts (Claude reads page 1) then reviewed by hand.
 * Every citation the chatbot emits is built from these fields, so a wrong
 * issueDate here becomes a wrong date in every answer that cites the document.
 */
export interface ManifestEntry {
  file: string
  sha256: string
  docType: DocType
  /** Stable uppercase code, e.g. "VINUNI", "HUST". Null for non-school documents. */
  school: string | null
  /** Human-readable title used in citations. */
  title: string
  /** Issuing body, e.g. "Bộ Giáo dục và Đào tạo". */
  authority: string | null
  /** Official document number, e.g. "2466/QĐ-ĐHBK". Null if the document has none. */
  docNumber: string | null
  /** ISO date from the document body. Null when genuinely absent — never guess. */
  issueDate: string | null
  /** Set when a human has checked this entry. Unreviewed entries are still indexed. */
  reviewed: boolean
  notes?: string
}

/** Output of stage 4 — the unit that gets embedded and retrieved. */
export interface Chunk {
  id: string
  /** Embedded text: contextual prefix + body. See chunk.ts. */
  text: string
  metadata: {
    sha256: string
    file: string
    title: string
    docType: DocType
    school: string | null
    authority: string | null
    docNumber: string | null
    issueDate: string | null
    /** Real page number, or null for DOCX. */
    page: number | null
    /** e.g. "Chương II › Điều 5" or "4. Phương thức xét tuyển › 4.2 Xét tuyển tài năng" */
    sectionPath: string
  }
}
