// hasannawaz.com is static files (wrangler.jsonc). This Worker only sees /api/* (Yalla, the site's
// AI assistant) and the reels (run_worker_first: /assets/work/*, /assets/building/*).
// For the reels it adds the one thing the static asset server doesn't do: byte ranges. Safari on iPhone and iPad streams a video in ranges and
// won't start one without them; it waits for the whole file instead, and seeking stalls.
// _headers isn't applied to Worker responses, so the reels' caching is set here.

import FACTS from './llms.txt';
import RULES from './yalla-prompt.txt';

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

// Yalla. Free on Workers AI: past the daily allowance the call fails, it never bills.
const MODEL = '@cf/openai/gpt-oss-120b';
const DAILY_LIMIT = 20; // messages per visitor per day
const MAX_CHARS = 500; // per visitor message
const MAX_REPLY = 1500; // characters per reply, so it can't be used as a free writing tool
const MAX_TURNS = 12; // history sent to the model
const SECTIONS = ['work', 'why', 'services', 'process', 'pricing', 'faq']; // where the visitor is on the page
const ORIGINS = ['https://hasannawaz.com', 'https://www.hasannawaz.com'];
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

// the text in 1 line of the model's event stream, whichever shape it comes in. Reasoning is skipped.
function deltaOf(line) {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const j = JSON.parse(data);
    if (typeof j.response === 'string') return j.response;
    const content = j.choices?.[0]?.delta?.content;
    if (typeof content === 'string') return content;
    if (j.type === 'response.output_text.delta' && typeof j.delta === 'string') return j.delta;
  } catch {}
  return '';
}

// turns the model's event stream into plain text for the page, and holds a reply to MAX_REPLY
function plainText(stream) {
  const encoder = new TextEncoder();
  let buffer = '';
  let sent = 0;
  const emit = (line, controller) => {
    const text = deltaOf(line.trim());
    if (!text || sent >= MAX_REPLY) return;
    sent += text.length;
    controller.enqueue(encoder.encode(text));
  };
  return stream.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) emit(line, controller);
    },
    flush(controller) {
      emit(buffer, controller);
    },
  }));
}

// counts a visitor's messages for the day in the edge cache. The IP is hashed with the date, so
// nothing readable is kept, and the count starts over daily.
async function overLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + day));
  const id = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = new Request(`https://hasannawaz.com/__yalla/${id}`);
  const hit = await caches.default.match(key);
  const count = hit ? Number(await hit.text()) : 0;
  if (count >= DAILY_LIMIT) return true;
  await caches.default.put(key, new Response(String(count + 1), { headers: { 'Cache-Control': 'max-age=86400' } }));
  return false;
}

async function yalla(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!ORIGINS.includes(request.headers.get('Origin'))) return json({ error: 'Not allowed' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const turns = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, t.role === 'user' ? MAX_CHARS : MAX_REPLY) }));
  if (turns.at(-1)?.role !== 'user') return json({ error: 'Bad request' }, 400);

  if (await overLimit(request)) return json({ limit: true });
  const where = SECTIONS.includes(body.context) ? `The visitor is on the ${body.context} section of the page.\n\n` : '';

  try {
    const stream = await env.AI.run(MODEL, {
      messages: [{ role: 'system', content: `${RULES}\n${where}SITE FACTS\n\n${FACTS}` }, ...turns],
      max_tokens: 900, // the model reasons first, and that counts
      temperature: 0.4,
      stream: true,
    });
    return new Response(plainText(stream), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return json({ limit: true }); // out of allowance or down: the page hands over to WhatsApp
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/yalla') return yalla(request, env);

    const res = await env.ASSETS.fetch(request);
    // a miss, a 304, or a range the asset server already answered: pass it on
    if (res.status !== 200) return res;

    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', CACHE);
    headers.set('X-Content-Type-Options', 'nosniff');

    const range = request.headers.get('Range');
    const m = range && request.method === 'GET' && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === '' && m[2] === '')) return new Response(res.body, { status: 200, headers });

    const body = await res.arrayBuffer();
    const size = body.byteLength;
    let start;
    let end;
    if (m[1] === '') { // the last n bytes
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.delete('Content-Length');
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
