import { NextResponse } from 'next/server';

const SERVER_URL = process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    agentId,
    workspaceId,
    content,
    actorId,
  } = body as {
    agentId?: string;
    workspaceId?: string;
    content?: string;
    actorId?: string;
  };

  if (!agentId || !workspaceId || !actorId || !content) {
    return NextResponse.json(
      { error: 'agentId, workspaceId, actorId and content are required fields' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/channel-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        workspaceId,
        content,
        actorId,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = (data as { error?: string }).error ?? 'Failed to call server channel-chat';
      return NextResponse.json({ error: message }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to reach ownlab server channel-chat: ${message}` },
      { status: 502 },
    );
  }
}

