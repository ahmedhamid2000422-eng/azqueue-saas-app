// Supabase Edge Function — server-side text-to-speech for TV displays.
//
// WHY THIS EXISTS
//   TV browsers (TV Bro, some Android WebViews, older smart-TV browsers) don't
//   expose the Web Speech API at all, so `speechSynthesis` is unavailable and
//   queue announcements are silent. This generates the audio server-side and
//   hands back an MP3 URL the display can play through plain WebAudio.
//
// CACHING
//   Queue announcements repeat constantly ("Ticket A14, please proceed to
//   Counter 1"). Each phrase is hashed and stored in the `tts-cache` Storage
//   bucket, so a given phrase costs one API call ever — subsequent calls are
//   a cheap storage lookup.
//
// SETUP
//   1. Storage → New bucket → name: tts-cache → Public bucket: ON
//   2. Edge Functions → Secrets → add OPENAI_API_KEY
//   3. Deploy this function with JWT verification OFF (public TV display)
//
// Body:    { text: string, voice?: string }
// Returns: { ok: true, url: string, cached: boolean }

const BUCKET = "tts-cache";
const DEFAULT_VOICE = "alloy";
const MODEL = Deno.env.get("OPENAI_TTS_MODEL") ?? "tts-1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });

/** Stable cache key for a phrase + voice. */
async function hashKey(text: string, voice: string): Promise<string> {
  const data = new TextEncoder().encode(`${MODEL}:${voice}:${text}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: { text?: string; voice?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const text = (body.text ?? "").toString().trim().slice(0, 400);
  const voice = (body.voice ?? DEFAULT_VOICE).toString();
  if (!text) return json({ error: "text is required" }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "Supabase env not available" }, 500);
  }

  const key = await hashKey(text, voice);
  const objectPath = `${key}.mp3`;
  const publicUrl  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;

  // ── 1. Cache hit? ──────────────────────────────────────────────────────
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return json({ ok: true, url: publicUrl, cached: true });
  } catch { /* fall through and generate */ }

  // ── 2. Generate via OpenAI ─────────────────────────────────────────────
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return json({ ok: false, error: "OPENAI_API_KEY not set", dryRun: true }, 200);
  }

  let audio: ArrayBuffer;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        voice,
        input: text,
        response_format: "mp3",
        speed: 0.95, // slightly slower reads more clearly across a room
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[tts-speak] OpenAI error", res.status, detail.slice(0, 300));
      return json({ ok: false, error: `TTS provider ${res.status}` }, 502);
    }
    audio = await res.arrayBuffer();
  } catch (e) {
    console.error("[tts-speak] fetch failed", e);
    return json({ ok: false, error: "TTS request failed" }, 502);
  }

  // ── 3. Cache in Storage (best-effort) ──────────────────────────────────
  try {
    const up = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "audio/mpeg",
          "x-upsert": "true",
        },
        body: audio,
      },
    );
    if (up.ok) return json({ ok: true, url: publicUrl, cached: false });
    console.warn("[tts-speak] cache upload failed", up.status, (await up.text()).slice(0, 200));
  } catch (e) {
    console.warn("[tts-speak] cache upload threw", e);
  }

  // ── 4. Couldn't cache — return the audio inline so playback still works ─
  return new Response(audio, {
    headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400", ...cors },
  });
});
