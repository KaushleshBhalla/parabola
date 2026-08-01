import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
