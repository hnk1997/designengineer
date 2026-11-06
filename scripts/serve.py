"""Local dev server with caching off, so edits show up on reload.
Answers byte-range requests like the live site does (worker.js), so videos stream and seek.

Yalla (POST /api/yalla) gets test replies here, marked "mock", so the page's states can be seen.
To talk to the real model, set CF_ACCOUNT_ID and CF_API_TOKEN (a Workers AI token)."""
import http.server
import json
import os
import re
import sys
import time
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
# pass 0.0.0.0 as a 2nd argument to open it to phones on the same Wi-Fi
HOST = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"


ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODEL = "@cf/google/gemma-4-26b-a4b-it"


def mock_reply(q):
    q = q.lower()
    if "limit" in q:
        return None
    if re.search(r"recipe|homework|poem|weather|write .*code", q):
        return "Tempting, but that’s outside my job. I only know Hasan’s work. [[offtopic]]"
    if re.search(r"which plan|cost|price|how much", q):
        return ("For most businesses that’s the Website plan, from AED 15,000, though it depends on what you need. "
                "What are you looking to build?\n[[show: pricing]]")
    if re.search(r"march|week|month|asap", q):
        return ("That’s doable as a target, and Hasan can tell you what’s realistic. "
                "Your brief is ready if you want to send it over.\n[[fields: when=March]]")
    if re.search(r"founder|customers?|startup|for my|for our|users", q):
        return "Nice, early days are a fun time to get this right. When are you hoping to go live?\n[[fields: who=Their startup]]"
    if re.search(r"website|landing|app|platform|build", q):
        return "Oh nice. What’s it for, and who are you hoping it reaches?\n[[fields: what=A website]]\n[[mood: excited]]"
    return "I’m not sure about that one, but Hasan will be.\n[[handoff]]\n[[mood: embarrassed]]"


def delta_of(line):
    """Same as deltaOf in worker.js."""
    if not line.startswith("data:"):
        return ""
    data = line[5:].strip()
    if not data or data == "[DONE]":
        return ""
    try:
        j = json.loads(data)
    except ValueError:
        return ""
    if isinstance(j.get("response"), str):
        return j["response"]
    content = ((j.get("choices") or [{}])[0].get("delta") or {}).get("content")
    if isinstance(content, str):
        return content
    if j.get("type") == "response.output_text.delta" and isinstance(j.get("delta"), str):
        return j["delta"]
    return ""


def real_stream(turns, context=""):
    """Same prompt and settings as worker.js, through Cloudflare's REST API."""
    read = lambda name: open(os.path.join(ROOT, name), encoding="utf-8").read()
    where = f"The visitor is on the {context} section of the page.\n\n" if context else ""
    system = read("yalla-prompt.txt") + "\n" + where + "SITE FACTS\n\n" + read("llms.txt")
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CF_ACCOUNT_ID']}/ai/run/{MODEL}",
        data=json.dumps({"messages": [{"role": "system", "content": system}] + turns[-12:],
                         "max_tokens": 400, "temperature": 0.4, "stream": True}).encode(),
        headers={"Authorization": f"Bearer {os.environ['CF_API_TOKEN']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=45) as res:
        for line in res:
            text = delta_of(line.decode("utf-8", "replace").strip())
            if text:
                yield text


class NoCache(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/yalla":
            return self.send_error(404)
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        turns = body.get("messages", [])
        real = bool(os.environ.get("CF_API_TOKEN"))
        text = None if real else mock_reply(turns[-1]["content"])
        if not real and text is None:
            body = b'{"limit": true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Yalla-Mock", "1")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        if not real:
            self.send_header("X-Yalla-Mock", "1")
        self.end_headers()
        try:
            if real:
                for part in real_stream(turns, body.get("context", "")):
                    self.wfile.write(part.encode())
                    self.wfile.flush()
            else:
                time.sleep(1.1)
                for word in re.findall(r"\S+\s*", text):
                    self.wfile.write(word.encode())
                    self.wfile.flush()
                    time.sleep(0.04)
        except OSError:
            pass  # the visitor pressed Stop
        except Exception as e:
            print("yalla:", e, file=sys.stderr)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", "").strip())
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path) or (m[1] == "" and m[2] == ""):
            return super().send_head()
        size = os.path.getsize(path)
        if m[1] == "":
            start, end = max(0, size - int(m[2])), size - 1
        else:
            start = int(m[1])
            end = size - 1 if m[2] == "" else min(int(m[2]), size - 1)
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self.range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "range_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)


http.server.ThreadingHTTPServer((HOST, PORT), NoCache).serve_forever()
