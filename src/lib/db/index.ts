import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export const db = env.databaseUrl
  ? drizzle(neon(env.databaseUrl), { schema })
  : null;

export { schema };
