import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

export async function POST(req) {
  try {
    const { channel, event, data } = await req.json();
    if (!channel || !event) {
      return Response.json({ ok: false, error: "channel y event requeridos" }, { status: 400 });
    }
    await pusher.trigger(channel, event, data);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
