import { NextResponse } from 'next/server';

const SERVER_URL = process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100';

export async function POST(
  req: Request,
  context: { params: Promise<{ type: string }> },
) {
  const { type } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    const res = await fetch(`${SERVER_URL}/api/agents/adapters/${encodeURIComponent(type)}/test-environment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error('Failed to proxy adapter test-environment:', error);
    return NextResponse.json(
      { error: 'Failed to test adapter environment' },
      { status: 500 },
    );
  }
}

