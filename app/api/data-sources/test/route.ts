import type { NextRequest } from 'next/server';
import { testSourceConfig } from '@/modules/ainderstanding/connect/lib/data-source-service';
import type { DbDriver, ConnectionMode, ConnectionCredentials, ConnectionSettings } from '@/core/types/workspace';

export const runtime = 'nodejs';

type TestBody = {
  dbType: DbDriver;
  connectionMode: ConnectionMode;
  credentials: ConnectionCredentials;
  settings?: ConnectionSettings;
};

export async function POST(req: NextRequest) {
  let body: TestBody;
  try {
    body = (await req.json()) as TestBody;
  } catch {
    return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const { dbType, connectionMode, credentials, settings = {} } = body;

  if (!credentials) {
    return Response.json({ error: 'MISSING_CREDENTIALS' }, { status: 400 });
  }

  try {
    const result = await testSourceConfig(dbType, connectionMode, credentials, settings);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'TEST_FAILED', message }, { status: 500 });
  }
}
