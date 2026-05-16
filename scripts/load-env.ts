import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
