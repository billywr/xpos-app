const TARGET_SIZE = 400;

/**
 * Resizes an image file to 400×400 px before upload. Scales to fit within
 * the target while maintaining aspect ratio, then centers on a 400×400 canvas.
 * Output format: JPEG at 0.9 quality for smaller file size.
 */
export function resizeImageTo400x400(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      const { width, height } = img;
      const scale = Math.min(TARGET_SIZE / width, TARGET_SIZE / height);
      const drawWidth = Math.round(width * scale);
      const drawHeight = Math.round(height * scale);
      const x = (TARGET_SIZE - drawWidth) / 2;
      const y = (TARGET_SIZE - drawHeight) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
      ctx.drawImage(img, x, y, drawWidth, drawHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create image blob"));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          const suffix = "-resized";
          const newName = `${baseName}${suffix}.jpg`;
          const resizedFile = new File([blob], newName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        "image/jpeg",
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
