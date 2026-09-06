import json
import ssl
import urllib.request

config_file = "/Users/solomacbookair/Documents/myApps/felicity_solar_dashboard/backend/config.json"
with open(config_file, "r") as f:
    cfg = json.load(f)

# Fix double Bearer prefix
token = cfg.get("bearer_token", "")
if token.startswith("Bearer Bearer_"):
    token = token.replace("Bearer Bearer_", "Bearer_")
elif token.startswith("Bearer Bearer "):
    token = token.replace("Bearer Bearer ", "Bearer ")

print("Clean Token:", token[:50] + "...")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "Content-Type": "application/json",
    "Authorization": token,
    "Accept": "application/json, text/plain, */*"
}

endpoints_to_test = [
    ("POST", "https://shine-api.felicitysolar.com/device/list_device_all_type", {}),
    ("POST", "https://shine-api.felicitysolar.com/device/list_device_all_type", {"pageNum": 1, "pageSize": 50}),
    ("POST", "https://shine-api.felicitysolar.com/plant/list_plant", {}),
    ("POST", "https://shine-api.felicitysolar.com/plant/get_plant_list", {}),
    ("POST", "https://shine-api.felicitysolar.com/device/list", {}),
]

for method, url, payload in endpoints_to_test:
    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            body = resp.read().decode('utf-8')
            print(f"\n[+] {method} {url} (payload={payload})")
            print("    Response:", body[:1000])
    except Exception as e:
        print(f"\n[-] {method} {url} Error: {e}")
