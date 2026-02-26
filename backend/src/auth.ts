import { betterAuth } from "better-auth";
import { apiKey } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create the database connection — use DATABASE_PATH env var if set (for containers),
// otherwise fall back to the default path relative to the source tree
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, "..", "database.sqlite");
const db = new Database(dbPath);

const baseUrl = process.env.BETTER_AUTH_BASE_URL || "http://localhost:3000";

// Build trusted origins from env vars, with defaults for local dev
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];
const envOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : [];
const trustedOrigins = [...new Set([...defaultOrigins, ...envOrigins, baseUrl])];

const authConfig = {
  database: db,
  baseURL: `${baseUrl}/api/auth`,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  plugins: [
    apiKey({
      defaultPrefix: "issues_",
      enableMetadata: true,
    }),
  ],
};

// Create auth instance
const authInstance = betterAuth(authConfig);

// Add event handlers after creating the instance
// Note: In Better Auth 1.3.x, events might need to be handled differently
// For now, we'll use a hook-based approach in the sign-up endpoint

export const auth = {
  handler: authInstance.handler,
  api: authInstance.api,
};
