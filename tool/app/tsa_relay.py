#!/usr/bin/env python3
"""本地时间戳中继：把 codesign 的 RFC3161 请求转发到 Apple TSA。

为什么需要：本机系统代理（127.0.0.1:7897）能过 curl，但 codesign 走
CFNetwork 用同一个代理时会报 "The timestamp service is not available"。
127.0.0.1 在代理例外列表里，所以让 codesign 打本地端口，由我们代为转发。

用法：
    python3 <水獭家族仓>/tool/app/tsa_relay.py 8899 &
    codesign --timestamp=http://127.0.0.1:8899/ts01 ...
"""

import sys
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TSA_URL = "http://timestamp.apple.com/ts01"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        req = urllib.request.Request(
            TSA_URL,
            data=body,
            headers={"Content-Type": "application/timestamp-query"},
            method="POST",
        )
        try:
            # 显式不走代理：直连 Apple TSA 实测可用。
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(req, timeout=30) as resp:
                payload = resp.read()
                ctype = resp.headers.get("Content-Type", "application/timestamp-reply")
        except Exception as exc:  # noqa: BLE001
            self.send_response(502)
            self.send_header("Content-Length", "0")
            self.end_headers()
            print(f"转发失败: {exc}", file=sys.stderr, flush=True)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):  # 安静点
        return


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    print(f"TSA relay on http://127.0.0.1:{port}/ts01 → {TSA_URL}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
