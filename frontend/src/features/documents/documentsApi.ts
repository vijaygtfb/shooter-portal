import { config } from "@/config";
import { apiRequest, ApiError } from "@/lib/apiClient";
import { docRefSchema, uploadUrlResponseSchema, viewUrlResponseSchema, type DocRef, type DocType } from "./schema";

/**
 * Upload flow (REQUIREMENTS §5): get a presigned POST, upload straight to S3, then confirm so the
 * server can check the magic bytes. File bytes never pass through Lambda.
 */
export async function uploadDocument(docType: DocType, file: File): Promise<DocRef> {
  const presigned = await apiRequest("/documents/upload-url", uploadUrlResponseSchema, {
    method: "POST",
    body: JSON.stringify({ doc_type: docType, file_name: file.name, content_type: file.type, size: file.size }),
  });

  if (config.useMockApi) {
    const { mockS3Upload } = await import("@/mocks/server");
    await mockS3Upload(presigned.key, file);
  } else {
    // Direct browser -> S3 upload. Not an API call, so it does not go through apiRequest().
    const form = new FormData();
    Object.entries(presigned.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);
    const res = await fetch(presigned.url, { method: "POST", body: form });
    if (!res.ok) throw new ApiError(res.status, "Upload failed. Please try again.");
  }

  return apiRequest("/documents/confirm", docRefSchema, {
    method: "POST",
    body: JSON.stringify({ doc_type: docType, key: presigned.key }),
  });
}

/** Short-lived preview link (presigned GET, 5 min). */
export async function documentViewUrl(key: string): Promise<string> {
  const { url } = await apiRequest(`/documents/view-url?key=${encodeURIComponent(key)}`, viewUrlResponseSchema);
  return url;
}
