import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const statements = readFileSync(path.join(__dirname, "rls.sql"), "utf-8");
  await sql.unsafe(statements);
  await sql.end();
  console.log("RLS enabled on all tables.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
