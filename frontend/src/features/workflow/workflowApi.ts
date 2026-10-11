import { apiRequest } from "@/lib/apiClient";
import { registrationSchema } from "@/features/registration/model";
import {
  coachOptionsSchema,
  staffUserSchema,
  staffUsersSchema,
  studentListSchema,
  type CoachApproveValues,
  type DistrictApproveValues,
  type RejectValues,
} from "./schema";

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export type ReviewerScope = "coach" | "district" | "admin";

export const fetchCoaches = (district?: string) =>
  apiRequest(`/coaches${district ? `?district=${encodeURIComponent(district)}` : ""}`, coachOptionsSchema);

export function fetchStudents(scope: ReviewerScope) {
  const path = scope === "admin" ? "/students" : `/${scope}/students`;
  return apiRequest(path, studentListSchema);
}

export const fetchStudent = (userId: string) => apiRequest(`/students/${userId}`, registrationSchema);

export const coachApprove = (userId: string, values: CoachApproveValues) =>
  apiRequest(`/coach/students/${userId}/approve`, registrationSchema, post(values));

export const coachReject = (userId: string, values: RejectValues) =>
  apiRequest(`/coach/students/${userId}/reject`, registrationSchema, post(values));

export const districtApprove = (userId: string, values: DistrictApproveValues) =>
  apiRequest(`/district/students/${userId}/approve`, registrationSchema, post(values));

export const districtReject = (userId: string, values: RejectValues) =>
  apiRequest(`/district/students/${userId}/reject`, registrationSchema, post(values));

export const fetchStaffUsers = () => apiRequest("/admin/users", staffUsersSchema);

export const changeStaffStatus = (userId: string, action: "activate" | "reject" | "deactivate") =>
  apiRequest(`/admin/users/${userId}/${action}`, staffUserSchema, post());
