import { apiRequest } from "@/lib/apiClient";
import { registrationSchema } from "./model";
import type { Mode } from "./schemas/fields";
import type { SubmitValues } from "./schemas/submit";

export const fetchRegistration = () => apiRequest("/registration", registrationSchema);

/** mode=draft is "Save for later" (format checks only); mode=complete is "Next" (full step validation). */
export const saveStep = (step: 1 | 2 | 3, values: object, mode: Mode) =>
  apiRequest(`/registration/steps/${step}?mode=${mode}`, registrationSchema, {
    method: "PUT",
    body: JSON.stringify(values),
  });

export const submitApplication = (values: SubmitValues) =>
  apiRequest("/registration/submit", registrationSchema, { method: "POST", body: JSON.stringify(values) });
