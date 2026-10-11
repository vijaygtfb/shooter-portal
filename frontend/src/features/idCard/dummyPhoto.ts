/**
 * Placeholder portrait used on the ID card for the demo (the real card will use the uploaded
 * PROFILE_PHOTO). Drawn as SVG so it needs no binary asset.
 */
export const DUMMY_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe6f1"/><stop offset="1" stop-color="#b9c6dc"/></linearGradient></defs>
<rect width="240" height="300" fill="url(#bg)"/>
<circle cx="120" cy="112" r="54" fill="#7e8ca6"/>
<path d="M28 300c0-62 41-104 92-104s92 42 92 104z" fill="#7e8ca6"/>
<rect x="0" y="270" width="240" height="30" fill="#23499b" opacity="0.85"/>
<text x="120" y="291" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#fff">SAMPLE PHOTO</text>
</svg>`;

export const DUMMY_PHOTO_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DUMMY_PHOTO_SVG)}`;

/** Rasterises the placeholder so jsPDF can embed it (jsPDF takes PNG/JPEG, not SVG). */
export function dummyPhotoPng(width = 240, height = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas is not available"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not load the placeholder photo"));
    img.src = DUMMY_PHOTO_URL;
  });
}
