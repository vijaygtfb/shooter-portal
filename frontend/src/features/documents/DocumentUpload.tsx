import { useId, useRef, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { Tooltip } from "primereact/tooltip";
import { errorMessage, fieldErrors } from "@/lib/apiClient";
import { logger } from "@/lib/logger";
import { uploadDocument } from "./documentsApi";
import { DocumentPreview } from "./DocumentPreview";
import { describeRule, DOC_RULES, fileSchema, formatBytes, type DocRef, type DocType } from "./schema";

interface DocumentUploadProps {
  id: string;
  docType: DocType;
  value: DocRef | null | undefined;
  onChange: (value: DocRef | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Optional documents can be removed. */
  removable?: boolean;
  /** Called with a client- or server-side error so the form can show it under the field. */
  onError?: (message: string | null) => void;
}

/**
 * Upload button + info tooltip (REQUIREMENTS §5). The file is checked here (type, max 1 MB), uploaded
 * straight to storage, then confirmed by the server, which checks the real file content.
 */
export function DocumentUpload({ id, docType, value, onChange, onBlur, invalid, disabled, removable, onError }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<DocRef | null>(null);
  const tipId = `tip-${useId().replace(/:/g, "")}`;
  const rule = DOC_RULES[docType];

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const check = fileSchema(docType).safeParse(file);
    if (!check.success) {
      // Don't mark the field touched here: re-validation would replace this message with "Upload this document".
      onError?.(check.error.issues[0]?.message ?? "This file cannot be uploaded");
      return;
    }
    onError?.(null);
    setUploading(true);
    try {
      const ref = await uploadDocument(docType, file);
      onChange(ref);
      onBlur?.();
      logger.info("document uploaded", { docType, size: ref.size });
    } catch (err) {
      onError?.(fieldErrors(err)[0]?.message ?? errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={rule.mimes.join(",")}
        onChange={onPick}
        hidden
        disabled={disabled || uploading}
      />
      <div className="upload-row">
        <Button
          type="button"
          label={value ? "Replace" : "Upload"}
          icon={value ? "pi pi-sync" : "pi pi-upload"}
          className={`btn-upload${invalid ? " p-invalid" : ""}`}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          aria-describedby={`${id}-error`}
          aria-label={`${value ? "Replace" : "Upload"} ${rule.label}`}
        />
        <Tooltip target={`.${tipId}`} position="top" />
        <i className={`pi pi-info-circle upload-info ${tipId}`} data-pr-tooltip={describeRule(docType)} aria-label={describeRule(docType)} tabIndex={0} />
        {value && !uploading && (
          <span className="upload-file">
            <i className={value.content_type === "application/pdf" ? "pi pi-file-pdf" : "pi pi-image"} aria-hidden="true" />
            <span className="upload-name" title={value.file_name}>
              {value.file_name}
            </span>
            <span className="muted small">({formatBytes(value.size)})</span>
            <Button type="button" icon="pi pi-eye" text rounded aria-label={`Preview ${rule.label}`} onClick={() => setPreview(value)} />
            {removable && !disabled && (
              <Button type="button" icon="pi pi-times" text rounded severity="danger" aria-label={`Remove ${rule.label}`} onClick={() => onChange(null)} />
            )}
          </span>
        )}
      </div>
      {uploading && <ProgressBar mode="indeterminate" className="upload-progress" aria-label="Uploading" />}
      <DocumentPreview doc={preview} onHide={() => setPreview(null)} />
    </div>
  );
}
