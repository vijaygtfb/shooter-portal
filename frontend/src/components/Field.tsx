import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + input + error, with the error announced to screen readers. */
export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small className="field-hint">{hint}</small>}
      <small id={errorId} className="p-error" aria-live="polite">
        {error ?? ""}
      </small>
    </div>
  );
}
