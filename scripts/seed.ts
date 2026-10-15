/**
 * `pnpm seed`: loads the demo into the Supabase project configured in .env.local.
 *
 * 1. Creates (or refreshes) the demo Auth users and their profiles, with portraits.
 * 2. Resets the Kinetic Studio and Lumen Labs workspaces to the seed data and uploads
 *    placeholder objects for every demo file.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD } from "../lib/data/seed";
import { ensureDemoUsers, resetDemoData } from "../lib/data/supabase/demo-seed";

async function main() {
  const envFile = resolve(process.cwd(), ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local.");
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`Seeding ${new URL(url).host}`);
  const users = await ensureDemoUsers(admin, { avatars: true });
  console.log(`  users      ${users.users} profiles (${users.created} new auth users), ${users.avatars} portraits`);
  for (const warning of users.warnings) console.warn(`  warning    ${warning}`);

  const data = await resetDemoData(admin);
  const rows = Object.values(data.inserted).reduce((sum, count) => sum + count, 0);
  console.log(`  data       ${rows} rows in ${Object.keys(data.inserted).length} tables`);
  console.log(`  storage    ${data.objects} placeholder files${data.removedObjects ? `, ${data.removedObjects} demo uploads removed` : ""}`);
  console.log(`Done. Sign in as alex@kinetic.example with the password "${DEMO_PASSWORD}".`);
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
