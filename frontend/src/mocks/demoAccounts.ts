/** DEMO ONLY - dummy logins listed on the login page. Kept dependency-free so it stays tiny. */
import type { Role } from "@/features/auth/schema";

export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_OTP = "123456";

export interface DemoAccount {
  email: string;
  role: Role;
  name: string;
  note: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "superadmin@demo.in", role: "SUPER_ADMIN", name: "Priya Nair", note: "Activates Coach / District Secretary logins" },
  { email: "coach@demo.in", role: "COACH", name: "Vikram Rathod", note: "Pune coach with students to review" },
  { email: "district@demo.in", role: "DISTRICT_SECRETARY", name: "Suresh Jadhav", note: "Pune District Secretary" },
  { email: "sneha.joshi@demo.in", role: "STUDENT", name: "Sneha Joshi", note: "Approved - can download ID card" },
  { email: "kabir.shinde@demo.in", role: "STUDENT", name: "Kabir Shinde", note: "Rejected by Coach" },
  { email: "aarav.patil@demo.in", role: "STUDENT", name: "Aarav Patil", note: "Submitted, awaiting Coach" },
  { email: "arjun.more@demo.in", role: "STUDENT", name: "Arjun More", note: "Draft - resumes at Step 2" },
  { email: "newcoach@demo.in", role: "COACH", name: "Nikhil Wagh", note: "Pending activation (cannot log in)" },
];
