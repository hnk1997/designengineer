"""Local dev server with caching off, so edits show up on reload.
Answers byte-range requests like the live site does (worker.js), so videos stream and seek."""
import http.server
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174


class NoCache(http.server.SimpleHTTPRequestHandler):
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


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCache).serve_forever()
