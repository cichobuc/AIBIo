import { NextResponse } from 'next/server';
import { validateSql } from '@/modules/ainderstanding/model/lib/sql-validator';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const { workspaceId } = await params;

  let body: { sql?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.sql !== 'string') {
    return NextResponse.json({ error: 'sql is required' }, { status: 400 });
  }

  const result = await validateSql(workspaceId, body.sql);
  return NextResponse.json({
    valid: result.valid,
    errors: result.errors,
    has_non_select_statements: result.hasNonSelectStatements,
    unresolved_refs: result.unresolvedRefs,
  });
}
