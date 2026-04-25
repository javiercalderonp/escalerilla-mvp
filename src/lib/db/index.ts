import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

export const db = env.databaseUrl
  ? drizzle(neon(env.databaseUrl), { schema })
  : null;

export { schema };
