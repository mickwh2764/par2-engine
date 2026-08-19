import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
pool.on('error', (err: Error) => {
  console.error('[db] Database pool error (non-fatal):', err.message);
});

export const db = drizzle(pool);
