export async function POST(req: Request) {
  // This route has been deprecated in favor of channel-based chat via /api/channel-chat.
  return new Response(
    JSON.stringify({ error: 'Direct /api/chat has been removed. Use /api/channel-chat instead.' }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
