const MAX_LOGO_DIMENSION = 240;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Turns an uploaded image into a small PNG data URI (at most 240×240).
 * The logo is stored on the company record and travels in API responses,
 * so it must stay small. Rejects with a user-facing message.
 */
export function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > MAX_FILE_BYTES) return reject(new Error('That image is larger than 5 MB — choose a smaller file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That file is not a readable image.'));
      image.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Could not process that image.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
