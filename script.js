import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(`https://id.twitch.tv/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token error: ${res.status} ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

app.get("/twitch/status", async (req, res) => {
  try {
    const userLogin = req.query.user_login;
    if (!userLogin) return res.status(400).json({ error: "Missing user_login" });

    const token = await getAppToken();
    const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(userLogin)}`, {
      headers: {
        "Client-Id": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
      },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Helix error: ${r.status} ${JSON.stringify(j)}`);

    const live = j.data && j.data.length > 0 ? j.data[0] : null;
    res.json({
      online: !!live,
      title: live?.title ?? null,
      viewer_count: live?.viewer_count ?? null,
      started_at: live?.started_at ?? null,
      game_id: live?.game_id ?? null,
      thumbnail_url: live?.thumbnail_url ?? null,
      raw: j, // opcionális debug
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
