import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { hashPassword, encryptReversible } from "../lib/auth/password";

config({ path: ".env.local" });

const OWNER_LOGIN = "owner";
const OWNER_PASSWORD = "owner123";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, OWNER_LOGIN))
    .limit(1);

  const passwordHash = await hashPassword(OWNER_PASSWORD);
  const passwordEncrypted = encryptReversible(OWNER_PASSWORD);

  if (existing) {
    await db
      .update(schema.users)
      .set({
        passwordHash,
        passwordEncrypted,
        role: "owner",
        isActive: true,
      })
      .where(eq(schema.users.id, existing.id));
    console.log(`Owner account updated (login: ${OWNER_LOGIN}).`);
  } else {
    await db.insert(schema.users).values({
      name: "Owner",
      email: OWNER_LOGIN,
      passwordHash,
      passwordEncrypted,
      role: "owner",
    });
    console.log(`Owner account created (login: ${OWNER_LOGIN}).`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
