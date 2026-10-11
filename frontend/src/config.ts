import { z } from "zod";

/** Runtime config injected via /config.js (see index.html + pipeline). Validated at startup. */
const configSchema = z.object({
  envName: z.enum(["local", "test", "uat", "prod"]),
  apiBaseUrl: z.url(),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  /** When true, apiRequest() is served by the in-browser mock server (demo mode). Never true in prod. */
  useMockApi: z.boolean().default(false),
  associationName: z.string().min(1).default("District Shooting Association"),
});

export type AppConfig = z.infer<typeof configSchema>;

declare global {
  interface Window {
    __APP_CONFIG__?: unknown;
  }
}

export const config: AppConfig = configSchema.parse(window.__APP_CONFIG__);
