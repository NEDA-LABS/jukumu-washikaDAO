/**
 * Read a file the user picked and return a compressed data-URL suitable for
 * storing inline in Postgres (profile avatars, group logos). We resize to a
 * square max side + JPEG-encode client-side so the payload stays tiny (~30 KB
 * for a 400×400 photo) — no external storage needed.
 */
export type AttachmentPayload = { dataUrl: string; name: string; mime: string };

/**
 * Read a proposal attachment. Images are resized down to `maxSide` keeping
 * their aspect ratio (no crop — receipts/quotes must stay readable) and
 * re-encoded as JPEG; PDFs are passed through raw with a hard size cap.
 */
export async function readAttachmentAsDataUrl(file: File, maxSide = 1200, quality = 0.85): Promise<AttachmentPayload> {
  if (file.type === 'application/pdf') {
    if (file.size > 2 * 1024 * 1024) throw new Error('PDF is too large. Keep it under 2 MB.');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    return { dataUrl, name: file.name, mime: file.type };
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only images and PDF files are supported.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large. Pick one under 10 MB.');
  }

  const srcUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode the image.'));
    el.src = srcUrl;
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return { dataUrl: canvas.toDataURL('image/jpeg', quality), name: file.name, mime: 'image/jpeg' };
}

export async function readImageAsResizedDataUrl(
  file: File,
  maxSize = 400,
  quality = 0.85,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please pick an image file.');
  }
  // Firm cap on raw input so a 20 MB photo doesn't OOM the tab before we resize.
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large. Pick one under 10 MB.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode the image.'));
    el.src = dataUrl;
  });

  // Center-crop to a square, then scale to maxSize.
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  const target = Math.min(maxSize, side);
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

  return canvas.toDataURL('image/jpeg', quality);
}
