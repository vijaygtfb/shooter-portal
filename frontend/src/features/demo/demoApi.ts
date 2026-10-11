import { z } from "zod";
import { apiRequest } from "@/lib/apiClient";

/** DEMO ONLY - endpoints that exist only in the mock server (src/mocks/server.ts). */
export const mailSchema = z.object({
  id: z.string(),
  to: z.string(),
  channel: z.enum(["EMAIL", "SMS"]),
  subject: z.string(),
  body: z.string(),
  link: z.string().optional(),
  at: z.string(),
});
export type DemoMail = z.infer<typeof mailSchema>;

export const fetchMailbox = () => apiRequest("/demo/mailbox", z.array(mailSchema));

export const resetDemoData = () => apiRequest("/demo/reset", z.object({ message: z.string() }), { method: "POST" });
