#!/usr/bin/env python3
"""Start the local arcade server and open it in your browser."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import socket
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser

HOST = "127.0.0.1"
DEFAULT_PORTS = (18765, 18766, 18767)
PING_PATH = "/__neo_arcade_ping"
PING_TEXT = "neo-arcade-ok"
PORT_FILE = Path(__file__).resolve().parent / ".arcade_port"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path == PING_PATH:
            payload = PING_TEXT.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        super().do_GET()


class ArcadeServer(ThreadingHTTPServer):
    allow_reuse_address = True


def is_tcp_port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex((host, port)) == 0


def is_arcade_server(host, port):
    url = f"http://{host}:{port}{PING_PATH}"
    try:
        with urlopen(url, timeout=0.35) as response:
            payload = response.read().decode("utf-8", errors="replace")
            return payload.strip() == PING_TEXT
    except URLError:
        return False
    except OSError:
        return False


def load_saved_port():
    try:
        value = PORT_FILE.read_text(encoding="utf-8").strip()
        port = int(value)
        if 1 <= port <= 65535:
            return port
    except (OSError, ValueError):
        pass

    return None


def save_port(port):
    try:
        PORT_FILE.write_text(str(port), encoding="utf-8")
    except OSError:
        pass


def get_port_candidates():
    ordered = []
    saved = load_saved_port()
    if saved:
        ordered.append(saved)
    for port in DEFAULT_PORTS:
        if port not in ordered:
            ordered.append(port)
    return ordered


def choose_target_port():
    for port in get_port_candidates():
        if not is_tcp_port_open(HOST, port):
            return ("start", port)

        if is_arcade_server(HOST, port):
            return ("reuse", port)

    raise RuntimeError(
        "Could not find an available local port. Tried: "
        + ", ".join(str(port) for port in get_port_candidates())
    )


def main():
    action, port = choose_target_port()
    url = f"http://{HOST}:{port}"
    should_open_browser = os.environ.get("NEO_ARCADE_NO_BROWSER") != "1"

    if action == "reuse":
        print(f"Arcade already running at {url}")
        if should_open_browser:
            webbrowser.open(url, new=2)
        return

    try:
        server = ArcadeServer((HOST, port), QuietHandler)
    except OSError as error:
        raise RuntimeError(f"Could not bind HTTP server on {url}: {error}") from error

    save_port(port)

    print(f"Arcade running at {url}")
    print("Press Ctrl+C to stop.")

    if should_open_browser:
        webbrowser.open(url, new=2)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
