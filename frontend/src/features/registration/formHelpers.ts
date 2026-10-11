import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { z } from "zod";
import { fieldErrors } from "@/lib/apiClient";

/** Puts Zod issues (from a manual draft check) onto the form fields. Returns true if there were any. */
export function applyZodIssues<T extends FieldValues>(error: z.ZodError, setError: UseFormSetError<T>, prefix = ""): boolean {
  error.issues.forEach((i) => {
    const path = i.path.map(String).join(".");
    setError(`${prefix}${path}` as Path<T>, { type: "manual", message: i.message });
  });
  return error.issues.length > 0;
}

/**
 * Maps a 422 from the server onto the form fields. `strip` removes a leading segment such as
 * "basic_info" when the error came from /registration/submit. Returns the messages that were mapped.
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, strip?: string): string[] {
  return fieldErrors(err).map((f) => {
    const path = strip && f.path.startsWith(`${strip}.`) ? f.path.slice(strip.length + 1) : f.path;
    setError(path as Path<T>, { type: "server", message: f.message });
    return f.message;
  });
}
