/* eslint-disable no-console */
import { config } from "@/config";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[config.logLevel]) return;
  const entry = { ts: new Date().toISOString(), level, env: config.envName, message, ...meta };
  (level === "debug" ? console.log : console[level])(entry);
}

/** The only logging API allowed in the app. Level is set by config.js (pipeline env var). */
export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
