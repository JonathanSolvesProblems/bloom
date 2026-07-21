import ExcelJS from 'exceljs'

/**
 * Read an Excel file into the same CSV text the booking parser already handles.
 *
 * The salon owner in the test video had an .xlsx and the file picker would not
 * even let them select it. Excel is the common case, not the exception, so it is
 * read here and handed to the same keyword column matcher as a CSV. Real dates
 * arrive as Date objects (no DD/MM guessing needed), formatted to YYYY-MM-DD.
 */

function csvCell(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) {
    // Local date parts, so a timezone shift cannot roll the day onto another one.
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // ExcelJS gives rich cell values for formulas, hyperlinks and emails; reduce
  // them to the underlying text so the column matcher sees a plain string.
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const flat = o.text ?? o.result ?? o.hyperlink ?? o.richText
    if (Array.isArray(flat)) return csvCell(flat.map((p) => (p as { text?: string }).text ?? '').join(''))
    if (flat != null) return csvCell(flat)
    return ''
  }
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function xlsxToCsv(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (!ws) return ''

  const lines: string[] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    // row.values is 1-indexed with a leading hole; drop it.
    const cells = (row.values as unknown[]).slice(1)
    lines.push(cells.map(csvCell).join(','))
  })
  return lines.join('\n')
}

/** xlsx is a zip archive, so it begins with the PK\x03\x04 local-file signature. */
export async function looksLikeXlsx(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  } catch {
    return false
  }
}
