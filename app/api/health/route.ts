import { sqlite } from '@/core/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_ENV = ['AIBIO_ENCRYPTION_KEY'] as const;

export async function GET() {
  const timestamp = new Date().toISOString();
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    return Response.json(
      { status: 'degraded', reason: `Missing env vars: ${missing.join(', ')}`, timestamp },
      { status: 503 },
    );
  }

  try {
    sqlite.prepare('SELECT 1').get();
  } catch {
    return Response.json(
      { status: 'degraded', reason: 'db_unreachable', timestamp },
      { status: 503 },
    );
  }

  return Response.json({ status: 'ok', timestamp });
}
