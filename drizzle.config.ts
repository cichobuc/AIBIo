import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  schema: './core/db/schema.ts',
  out: './core/db/migrations',
} satisfies Config;
