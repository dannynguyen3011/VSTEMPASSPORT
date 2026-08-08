/**
 * Generates small synthetic multi-page PDFs used to validate the RAG ingest
 * pipeline (page-accurate parsing + chunking) without needing the real
 * admissions corpus. Output is committed to git — see
 * test/fixtures/rag-corpus/README.md.
 *
 * Run: npx tsx scripts/generate-fixture-pdfs.ts
 *
 * Note: pdf-lib's standard (non-embedded) fonts only support WinAnsi
 * encoding, which does not cover Vietnamese diacritics. Fixture text is
 * written in unaccented Vietnamese (ASCII-safe) — fine for testing
 * page-boundary tracking, since only the real corpus needs true Vietnamese
 * text/embedding-quality validation.
 */
import fs from 'fs'
import path from 'path'
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib'

const OUTPUT_DIR = path.join(process.cwd(), 'test', 'fixtures', 'rag-corpus')

interface FixtureDoc {
  filename: string
  pages: string[]
}

const FIXTURES: FixtureDoc[] = [
  {
    filename: 'fake-truong-a-de-an-2026.pdf',
    pages: [
      'DE AN TUYEN SINH TRUONG A 2026\n\nChuong 1: Dieu kien xet tuyen\n\nDiem GPA toi thieu la 8.0 tren thang diem 10 doi voi tat ca cac nganh dao tao.',
      'Chuong 2: Yeu cau chung chi quoc te\n\nDiem SAT toi thieu 1200 (thang diem 1600) hoac tuong duong ACT 26 tro len.',
      'Chuong 3: Yeu cau tieng Anh\n\nChung chi IELTS toi thieu 5.0, hoac TOEFL iBT toi thieu 61 diem.',
      'Chuong 4: Hoc phi va hoc bong\n\nHoc bong toan phan danh cho thi sinh co diem GPA tren 9.0 va IELTS tu 7.0 tro len.',
    ],
  },
  {
    filename: 'fake-thong-tu-fake-2026.pdf',
    pages: [
      'THONG TU FAKE 06/2026/TT-BGDDT\n\nDieu 1: Pham vi dieu chinh\n\nThong tu nay quy dinh nguyen tac chung ve xet tuyen dai hoc nam 2026.',
      'Dieu 2: Nguyen tac xet tuyen\n\nCac truong dai hoc phai cong bo cong khai de an tuyen sinh truoc ngay 01 thang 3 hang nam.',
      'Dieu 3: Dieu khoan thi hanh\n\nThong tu co hieu luc thi hanh ke tu ngay 01 thang 01 nam 2026.',
    ],
  },
]

async function generatePdf(doc: FixtureDoc): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const pageText of doc.pages) {
    const page = pdfDoc.addPage([595, 842]) // A4
    const fontSize = 12
    const margin = 50
    const maxWidth = 595 - margin * 2
    const lines = wrapText(pageText, font, fontSize, maxWidth)

    let y = 842 - margin
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) })
      y -= fontSize * 1.4
    }
  }

  return pdfDoc.save()
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  for (const doc of FIXTURES) {
    const bytes = await generatePdf(doc)
    const outPath = path.join(OUTPUT_DIR, doc.filename)
    fs.writeFileSync(outPath, bytes)
    console.log(`✓ ${doc.filename} (${doc.pages.length} pages)`)
  }

  console.log(`\nFixtures written to ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('❌ Fixture generation failed:', err)
  process.exit(1)
})
