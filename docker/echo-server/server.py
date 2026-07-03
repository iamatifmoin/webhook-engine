import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class EchoHandler(BaseHTTPRequestHandler):
    def _handle(self) -> None:
        length = int(self.headers.get('content-length', '0') or '0')
        body = self.rfile.read(length).decode('utf-8', 'replace') if length else ''
        response = {
            'method': self.command,
            'url': self.path,
            'headers': dict(self.headers),
            'body': body,
        }
        payload = json.dumps(response).encode('utf-8')
        print(json.dumps(response), flush=True)
        self.send_response(200)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        self._handle()

    def do_POST(self) -> None:
        self._handle()

    def log_message(self, format, *args) -> None:
        return


ThreadingHTTPServer(('0.0.0.0', 8888), EchoHandler).serve_forever()
