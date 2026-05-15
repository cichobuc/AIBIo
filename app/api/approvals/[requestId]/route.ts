import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  hasPendingGate,
  wasAlreadyResolved,
  resolveApproval,
} from '@/core/orchestration/approval-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  decision: z.enum(['approved', 'denied']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST_BODY', message: 'Expected { decision: "approved" | "denied" }' },
      { status: 400 },
    );
  }

  if (!hasPendingGate(requestId)) {
    if (wasAlreadyResolved(requestId)) {
      return NextResponse.json(
        { error: 'APPROVAL_ALREADY_RESOLVED', message: 'Approval gate was already resolved' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: 'APPROVAL_REQUEST_NOT_FOUND',
        message: 'Approval gate not found — may have timed out',
      },
      { status: 404 },
    );
  }

  resolveApproval(requestId, body.decision);

  return NextResponse.json({ resolved: true, requestId });
}
