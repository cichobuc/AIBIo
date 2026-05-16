import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'not_implemented', message: 'Save as model will be available in a future release.' },
    { status: 501 },
  );
}
