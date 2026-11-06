// hasannawaz.com is static files (wrangler.jsonc). This Worker only sees /api/* (Yalla, the site's
// AI assistant) and the reels (run_worker_first: /assets/work/*, /assets/building/*).
// For the reels it adds the one thing the static asset server doesn't do: byte ranges. Safari on iPhone and iPad streams a video in ranges and
// won't start one without them; it waits for the whole file instead, and seeking stalls.
// _headers isn't applied to Worker responses, so the reels' caching is set here.

import FACTS from './llms.txt';
import RULES from './yalla-prompt.txt';

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

// Yalla. Free on Workers AI: past the daily allowance the call fails, it never bills.
// Thinking is off (reasoning_effort below): gpt-oss-120b took 3 to 19s to start because it reasons first
const MODEL = '@cf/deepseek-ai/deepseek-v4.1-flash-1017';
const DAILY_LIMIT = 200; // messages per visitor per day
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
function plainText(stream, done) {
  const encoder = new TextEncoder();
  let buffer = '';
  let sent = 0;
  let reply = '';
  const emit = (line, controller) => {
    const text = deltaOf(line.trim());
    if (!text || sent >= MAX_REPLY) return;
    sent += text.length;
    reply += text;
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
      done(reply);
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

// Chats are kept for 30 days so Hasan can read them at /api/chats. Each one is a random id, the page
// section and the messages: no IP, no name. Newest sort first because keys count down.
const KEEP = 60 * 60 * 24 * 30;
const CHAT_ID = /^\d{13}-[a-z0-9]{6,12}$/;
function saveChat(env, id, section, turns, reply) {
  if (!env.CHATS || !CHAT_ID.test(id || '')) return null;
  const started = Number(id.slice(0, 13));
  const key = `chat:${String(9999999999999 - started).padStart(13, '0')}:${id}`;
  const answer = reply.replace(/\[\[[^\]]*\]\]?/g, '').trim();
  const value = { started, updated: Date.now(), section, turns: [...turns, { role: 'assistant', content: answer }] };
  return env.CHATS.put(key, JSON.stringify(value), { expirationTtl: KEEP });
}

const digest = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).join();
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Hasan's private page. Without the CHATS_PASSWORD secret set, it doesn't exist.
async function chats(request, env) {
  if (!env.CHATS_PASSWORD || !env.CHATS) return new Response('Not found', { status: 404 });
  const given = atob((request.headers.get('Authorization') || '').replace(/^Basic /, '') || '').split(':').slice(1).join(':');
  if (await digest(given) !== await digest(env.CHATS_PASSWORD)) {
    return new Response('Private', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Yalla chats"', 'Cache-Control': 'no-store' } });
  }
  const { keys } = await env.CHATS.list({ prefix: 'chat:', limit: 100 });
  const rows = await Promise.all(keys.map((k) => env.CHATS.get(k.name, 'json')));
  const when = (t) => new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' });
  const body = rows.filter(Boolean).map((c) => `<section><h2>${esc(when(c.started))}${c.section ? ` · ${esc(c.section)}` : ''}</h2>${
    c.turns.map((t) => `<p class="${t.role === 'user' ? 'you' : 'bot'}">${esc(t.content)}</p>`).join('')}</section>`).join('');
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Yalla chats</title><style>
body{margin:0 auto;max-width:680px;padding:32px 16px 96px;background:#eceef1;color:#0b0c0f;font:16px/1.5 system-ui,sans-serif}h1{margin:0 0 4px;font-size:32px;letter-spacing:-.03em}small{color:#0b0c0f9e}
section{margin-top:20px;padding:16px;background:#fff}h2{margin:0 0 12px;font-size:13px;font-weight:500;color:#0b0c0f9e}p{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}.you{margin-left:auto;width:fit-content;max-width:85%;padding:8px 12px;background:#f973161f}</style></head>
<body><h1>Yalla chats</h1><small>${rows.length} recent, kept for 30 days. Dubai time.</small>${body || '<section><p>No chats yet.</p></section>'}</body></html>`;
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

async function yalla(request, env, ctx) {
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

  if (await overLimit(request)) return json({ limit: true, why: 'visitor' });
  const where = SECTIONS.includes(body.context) ? `The visitor is on the ${body.context} section of the page.\n\n` : '';

  try {
    const stream = await env.AI.run(MODEL, {
      messages: [{ role: 'system', content: `${RULES}\n${where}SITE FACTS\n\n${FACTS}` }, ...turns],
      max_tokens: 400,
      temperature: 0.4,
      reasoning_effort: 'none',
      stream: true,
    });
    const section = SECTIONS.includes(body.context) ? body.context : '';
    const finished = (reply) => {
      const saving = saveChat(env, body.chat, section, turns, reply);
      if (saving) ctx.waitUntil(saving.catch(() => {}));
    };
    return new Response(plainText(stream, finished), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return json({ limit: true, why: String(e?.message || e).slice(0, 200) }); // out of allowance or down: the page hands over to WhatsApp
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/yalla') return yalla(request, env, ctx);
    if (pathname === '/api/chats') return chats(request, env);

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
