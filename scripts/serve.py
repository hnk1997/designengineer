"""Local dev server with caching off, so edits show up on reload."""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCache).serve_forever()
