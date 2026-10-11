import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { Message } from "primereact/message";
import { errorMessage } from "@/lib/apiClient";
import { documentViewUrl } from "./documentsApi";
import type { DocRef } from "./schema";

/** Opens a document through a short-lived view URL. PDFs show in a frame, images inline. */
export function DocumentPreview({ doc, onHide }: { doc: DocRef | null; onHide: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setUrl(null);
    setError(null);
    documentViewUrl(doc.key)
      .then((u) => !cancelled && setUrl(u))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const isPdf = doc?.content_type === "application/pdf" && url && !url.startsWith("data:image");

  return (
    <Dialog header={doc?.file_name ?? "Document"} visible={!!doc} onHide={onHide} modal style={{ width: "min(56rem, 95vw)" }} className="doc-preview">
      {error && <Message severity="error" text={error} />}
      {!url && !error && <ProgressSpinner style={{ width: 40, height: 40 }} />}
      {url && (isPdf ? <iframe src={url} title={doc?.file_name} className="doc-frame" /> : <img src={url} alt={doc?.file_name} className="doc-img" />)}
    </Dialog>
  );
}
