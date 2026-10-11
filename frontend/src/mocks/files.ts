/**
 * DEMO ONLY - stands in for the private S3 documents bucket.
 * Files uploaded in this browser session are kept in memory. Seeded or older documents preview as a
 * placeholder image.
 */

const objects = new Map<string, File>();
const objectUrls = new Map<string, string>();

export function putObject(key: string, file: File) {
  const old = objectUrls.get(key);
  if (old && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(old);
  objects.set(key, file);
  objectUrls.delete(key);
}

export function getObject(key: string): File | undefined {
  return objects.get(key);
}

export function deleteObject(key: string) {
  objects.delete(key);
  const url = objectUrls.get(key);
  if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
  objectUrls.delete(key);
}

/** Checks magic bytes the way the backend's /documents/confirm will (REQUIREMENTS §5). */
export async function sniffType(file: File): Promise<"application/pdf" | "image/jpeg" | "image/png" | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

function placeholder(fileName: string): string {
  const safe = fileName.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
<rect width="595" height="842" fill="#f6f7f9"/><rect x="40" y="40" width="515" height="762" fill="#fff" stroke="#c9ced6"/>
<text x="297" y="120" text-anchor="middle" font-family="Arial" font-size="26" fill="#23499b">SAMPLE DOCUMENT</text>
<text x="297" y="160" text-anchor="middle" font-family="Arial" font-size="16" fill="#555">${safe}</text>
${[220, 260, 300, 340, 380, 420, 460].map((y) => `<rect x="80" y="${y}" width="${435 - (y % 90)}" height="12" rx="6" fill="#e3e6eb"/>`).join("")}
<text x="297" y="760" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">Demo data - no real file stored</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A short-lived "presigned GET" URL. */
export function viewUrl(key: string, fileName: string): string {
  const file = objects.get(key);
  if (!file || typeof URL.createObjectURL !== "function") return placeholder(fileName);
  let url = objectUrls.get(key);
  if (!url) {
    url = URL.createObjectURL(file);
    objectUrls.set(key, url);
  }
  return url;
}
