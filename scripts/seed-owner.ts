import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import * as schema from "../lib/db/schema";

config({ path: ".env.local" });

const ownerEmail = process.argv[2];

async function main() {
  if (!ownerEmail) {
    throw new Error(
      "Usage: npm run seed:owner -- <owner-email>\n" +
        "Pass the real email address that should be invited as the owner."
    );
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not set");
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, ownerEmail))
    .limit(1);

  if (existing) {
    await db
      .update(schema.users)
      .set({ role: "owner", isActive: true })
      .where(eq(schema.users.id, existing.id));
    console.log(`Owner account updated (email: ${ownerEmail}).`);
  } else {
    await db.insert(schema.users).values({
      name: "Owner",
      email: ownerEmail,
      role: "owner",
    });
    console.log(`Owner account created (email: ${ownerEmail}).`);
  }

  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  await clerkClient.invitations.createInvitation({
    emailAddress: ownerEmail,
    ignoreExisting: true,
  });
  console.log(`Clerk invitation sent to ${ownerEmail}.`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
