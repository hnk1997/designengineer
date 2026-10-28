// hasannawaz.com is static files (wrangler.jsonc). This Worker only sees the reels
// (run_worker_first: /assets/work/*, /assets/building/*) and adds the one thing the static
// asset server doesn't do: byte ranges. Safari on iPhone and iPad streams a video in ranges and
// won't start one without them; it waits for the whole file instead, and seeking stalls.
// _headers isn't applied to Worker responses, so the reels' caching is set here.

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

export default {
  async fetch(request, env) {
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
