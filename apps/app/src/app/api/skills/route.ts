import { NextResponse } from 'next/server';

const SERVER_URL = process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100';

async function proxy(req: Request, method: string) {
  try {
    const url = new URL(req.url);
    const targetUrl = `${SERVER_URL}/api/skills${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}`;
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await req.text().catch(() => '');

    const res = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': req.headers.get('content-type') ?? 'application/json',
      },
      body: body && body.length > 0 ? body : undefined,
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to reach ownlab server skills API: ${message}` }, { status: 502 });
  }
}

export async function GET(req: Request) {
  return proxy(req, 'GET');
}

export async function POST(req: Request) {
  return proxy(req, 'POST');
}
