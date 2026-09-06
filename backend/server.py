import os
import sys
import json
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from api_client import FelicityAPIClient

PORT = 8085
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
client = FelicityAPIClient()

history_cache = []

def generate_initial_history():
    global history_cache
    now = time.time()
    history_cache = []
    import math
    for i in range(24, 0, -1):
        t_stamp = time.strftime("%H:00", time.localtime(now - i * 3600))
        hour = int(t_stamp.split(":")[0])
        # Solar generation curve peak between 10am and 4pm
        if 6 <= hour <= 18:
            pv = round(3500 * math.sin(math.pi * (hour - 6) / 12), 1)
        else:
            pv = 0
        load = round(1200 + 600 * math.sin(hour / 4), 1)
        bat_soc = max(30, min(100, round(50 + 40 * math.sin((hour - 8) / 4), 1)))
        history_cache.append({
            "time": t_stamp,
            "pv_power": pv,
            "load_power": load,
            "battery_soc": bat_soc
        })

generate_initial_history()

class DashboardRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            telemetry = client.get_telemetry()
            self.wfile.write(json.dumps(telemetry).encode("utf-8"))
            return
            
        elif self.path == "/api/history":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(history_cache).encode("utf-8"))
            return

        super().do_GET()

    def do_POST(self):
        if self.path == "/api/config":
            content_len = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_len)
            try:
                body = json.loads(post_body.decode("utf-8"))
                email = body.get("email", "").strip()
                password = body.get("password", "").strip()
                
                success = client.login(email, password)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                resp = {
                    "success": success,
                    "message": "Connected to Felicity Solar Cloud!" if success else "Failed to authenticate with Felicity Cloud. Please check your login credentials."
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode("utf-8"))
            return

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def main():
    print(f"\n=======================================================")
    print(f" Felicity Solar Custom Dashboard Server Running!")
    print(f" Access UI in Browser: http://localhost:{PORT}")
    print(f"=======================================================\n")
    server = HTTPServer(("0.0.0.0", PORT), DashboardRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down dashboard server...")
        server.server_close()

if __name__ == "__main__":
    main()
