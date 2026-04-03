import { describe, it, expect } from 'vitest';
import { validateUpload } from './document-parser';

describe('validateUpload', () => {
  it('rejects files over 10MB', () => {
    const result = validateUpload('test.pdf', 11 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('rejects unsupported file types', () => {
    const result = validateUpload('test.txt', 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('PDF, PPTX');
  });

  it('accepts valid PDF', () => {
    const result = validateUpload('training.pdf', 5 * 1024 * 1024);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid PPTX', () => {
    const result = validateUpload('slides.pptx', 1000);
    expect(result.valid).toBe(true);
  });

  it('accepts valid DOCX', () => {
    const result = validateUpload('document.docx', 1000);
    expect(result.valid).toBe(true);
  });

  it('rejects .exe files', () => {
    const result = validateUpload('malware.exe', 500);
    expect(result.valid).toBe(false);
  });

  it('is case-insensitive for extensions', () => {
    const result = validateUpload('TRAINING.PDF', 1000);
    expect(result.valid).toBe(true);
  });
});
