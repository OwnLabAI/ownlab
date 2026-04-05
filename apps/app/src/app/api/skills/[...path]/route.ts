import { NextResponse } from 'next/server';

const SERVER_URL = process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100';

function buildTargetUrl(pathSegments: string[] = [], searchParams: string) {
  const path = pathSegments.length > 0 ? `/${pathSegments.map(encodeURIComponent).join('/')}` : '';
  return `${SERVER_URL}/api/skills${path}${searchParams ? `?${searchParams}` : ''}`;
}

async function proxy(req: Request, method: string, params: { path?: string[] }) {
  try {
    const url = new URL(req.url);
    const targetUrl = buildTargetUrl(params.path ?? [], url.searchParams.toString());
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

export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, 'GET', await ctx.params);
}

export async function POST(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, 'POST', await ctx.params);
}

export async function PUT(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, 'PUT', await ctx.params);
}
