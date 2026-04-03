const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.pptx', '.docx'];
const MIN_EXTRACTED_TEXT_LENGTH = 100;

export function validateUpload(filename: string, sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds 10MB limit (${Math.round(sizeBytes / 1024 / 1024)}MB)` };
  }
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported file type. Accepted: PDF, PPTX, DOCX` };
  }
  return { valid: true };
}

export async function extractText(buffer: Buffer, filename: string): Promise<{ text: string; error?: string }> {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  try {
    let text = '';

    if (ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === '.pptx' || ext === '.docx') {
      const { parseOfficeAsync } = await import('officeparser');
      text = await parseOfficeAsync(buffer);
    }

    text = text.trim();
    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return { text: '', error: `Extracted text too short (${text.length} chars). Try a different format or paste text directly.` };
    }

    return { text };
  } catch (err) {
    return { text: '', error: `Failed to extract text: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
}
