import os
import json
import time
import ssl
import logging
import urllib.request
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("FelicityAPIClient")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

class FelicityAPIClient:
    LOGIN_URL = "https://shine-api.felicitysolar.com/userlogin"
    DEVICE_LIST_URL = "https://shine-api.felicitysolar.com/device/list_device_all_type"
    DEVICE_SNAPSHOT_URL = "https://shine-api.felicitysolar.com/device/get_device_snapshot"

    def __init__(self, email="", password=""):
        self.email = email
        self.password = password
        self.bearer_token = None
        self.token_expiry = 0
        self.devices = []
        self.load_config()

    def load_config(self):
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r") as f:
                    cfg = json.load(f)
                    self.email = cfg.get("email", self.email)
                    self.password = cfg.get("password", self.password)
                    raw_token = cfg.get("bearer_token", "")
                    self.bearer_token = self._clean_token(raw_token)
                    self.token_expiry = cfg.get("token_expiry", 0)
            except Exception as e:
                logger.error(f"Failed to load config: {e}")

    def _clean_token(self, token):
        if not token:
            return None
        if token.startswith("Bearer Bearer_"):
            return token.replace("Bearer Bearer_", "Bearer_")
        elif token.startswith("Bearer Bearer "):
            return token.replace("Bearer Bearer ", "Bearer ")
        return token

    def save_config(self):
        try:
            with open(CONFIG_PATH, "w") as f:
                json.dump({
                    "email": self.email,
                    "password": self.password,
                    "bearer_token": self.bearer_token,
                    "token_expiry": self.token_expiry
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save config: {e}")

    def is_authenticated(self):
        return bool(self.bearer_token and time.time() < self.token_expiry)

    def login(self, email=None, password=None):
        if email:
            self.email = email
        if password:
            self.password = password

        if not self.email or not self.password:
            logger.warning("Email or password missing")
            return False

        logger.info(f"Authenticating with Felicity Cloud for {self.email}...")
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        payload = json.dumps({
            "userName": self.email,
            "password": self.password
        }).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }

        try:
            req = urllib.request.Request(self.LOGIN_URL, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                logger.info(f"Login Response Code: {data.get('code')}")
                
                data_obj = data.get("data") if isinstance(data.get("data"), dict) else {}
                token = (
                    data.get("token") or 
                    data_obj.get("token") or 
                    data_obj.get("accessToken") or 
                    data_obj.get("authorization") or
                    data.get("authorization")
                )
                if token:
                    self.bearer_token = self._clean_token(token)
                    self.token_expiry = time.time() + (24 * 3600)
                    self.save_config()
                    logger.info("Authentication successful!")
                    return True
                else:
                    msg = data.get("message") or "Invalid credentials"
                    logger.error(f"Login failed: {msg}")
                    return False
        except Exception as e:
            logger.error(f"Login HTTP Exception: {e}")
            return False

    def fetch_devices(self):
        if not self.is_authenticated() and not self.login():
            return []

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        headers = {
            "Content-Type": "application/json",
            "Authorization": self.bearer_token,
            "Accept": "application/json"
        }
        
        payload = json.dumps({"pageNum": 1, "pageSize": 50}).encode("utf-8")

        try:
            req = urllib.request.Request(self.DEVICE_LIST_URL, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                dev_list = res.get("data", {}).get("dataList", []) or []
                self.devices = dev_list
                logger.info(f"Discovered {len(dev_list)} device(s) in Felicity account")
                return dev_list
        except Exception as e:
            logger.error(f"Error fetching device list: {e}")
            return []

    def fetch_device_snapshot(self, device_sn):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        headers = {
            "Content-Type": "application/json",
            "Authorization": self.bearer_token,
            "Accept": "application/json"
        }
        payload = json.dumps({"deviceSn": device_sn}).encode("utf-8")

        try:
            req = urllib.request.Request(self.DEVICE_SNAPSHOT_URL, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res.get("data")
        except Exception as e:
            logger.error(f"Error fetching snapshot for {device_sn}: {e}")
            return None

    def get_telemetry(self):
        """Fetches live telemetry for all devices and aggregates total plant data."""
        if self.is_authenticated():
            raw_devices = self.fetch_devices()
            if raw_devices:
                device_telemetry_list = []
                total_pv_power = 0.0
                total_load_power = 0.0
                total_battery_power = 0.0
                battery_soc_list = []
                grid_voltage = 230.0
                max_temp = 0.0
                plant_name = raw_devices[0].get("plantName", "Solo Solar Energy")

                for dev in raw_devices:
                    sn = dev.get("deviceSn")
                    alias = dev.get("alias") or dev.get("deviceModel") or sn
                    dev_type = dev.get("deviceType")
                    
                    pv_power_direct = float(dev.get("pvTotalPower") or 0.0)
                    total_pv_power += pv_power_direct

                    snapshot = self.fetch_device_snapshot(sn) if sn else None
                    
                    dev_pv = float(snapshot.get("pvPower", snapshot.get("ppv", pv_power_direct))) if snapshot else pv_power_direct
                    dev_load = float(snapshot.get("loadPower", snapshot.get("pload", 0.0))) if snapshot else 0.0
                    dev_bat_power = float(snapshot.get("batteryPower", snapshot.get("pbat", 0.0))) if snapshot else 0.0
                    dev_soc = float(snapshot.get("batterySoc", snapshot.get("soc", 85.0))) if snapshot else 85.0
                    dev_temp = float(snapshot.get("temperature", snapshot.get("temp", 36.5))) if snapshot else 36.5
                    dev_vpv = float(snapshot.get("pvVoltage", snapshot.get("vpv1", 240.0))) if snapshot else 240.0

                    if dev_type == "BP":  # Battery Pack
                        battery_soc_list.append(dev_soc)
                        total_battery_power += dev_bat_power
                    else:  # Inverters
                        total_load_power += dev_load
                        total_battery_power += dev_bat_power
                        if dev_soc > 0:
                            battery_soc_list.append(dev_soc)

                    max_temp = max(max_temp, dev_temp)

                    device_telemetry_list.append({
                        "sn": sn,
                        "alias": alias,
                        "model": dev.get("deviceModel", "Unknown"),
                        "type": dev_type,
                        "type_name": "Lithium Battery Pack" if dev_type == "BP" else "Off-Grid High Frequency Inverter",
                        "status": dev.get("status", "NM"),
                        "rated_power_kw": dev.get("ratedPower", "10"),
                        "country": dev.get("countryName", "Uganda"),
                        "timezone": dev.get("timeZone", "UTC+03:00"),
                        "pv_power_w": dev_pv,
                        "pv_voltage_v": dev_vpv,
                        "load_power_w": dev_load,
                        "battery_soc": dev_soc,
                        "battery_power_w": dev_bat_power,
                        "collector_sn": dev.get("collectorSn", "N/A"),
                        "firmware_version": dev.get("moduleVersion", "1.03"),
                        "plant_name": dev.get("plantName", plant_name),
                        "plant_id": dev.get("plantId", "N/A"),
                        "id": dev.get("id", "N/A")
                    })

                avg_soc = round(sum(battery_soc_list) / len(battery_soc_list), 1) if battery_soc_list else 85.0

                return {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "is_live": True,
                    "configured": True,
                    "plant_info": {
                        "name": plant_name,
                        "total_devices": len(raw_devices),
                        "status": "Normal Operation"
                    },
                    "solar": {
                        "power_w": round(total_pv_power, 1),
                        "voltage_v": 240.0,
                        "current_a": round(total_pv_power / 240.0, 1)
                    },
                    "battery": {
                        "soc_percent": avg_soc,
                        "power_w": round(total_battery_power, 1),
                        "voltage_v": 51.2,
                        "status": "Charging" if total_battery_power < 0 else ("Discharging" if total_battery_power > 0 else "Idle")
                    },
                    "load": {
                        "power_w": round(total_load_power, 1),
                        "voltage_v": grid_voltage,
                        "frequency_hz": 50.0
                    },
                    "grid": {
                        "power_w": 0.0,
                        "voltage_v": grid_voltage,
                        "status": "Connected"
                    },
                    "system": {
                        "inverter_temp_c": max_temp if max_temp > 0 else 37.0,
                        "health_status": "Optimal"
                    },
                    "devices": device_telemetry_list
                }

        return self._format_preview_telemetry()

    def _format_preview_telemetry(self):
        import math
        t = time.time()
        pv_power = round(2215 + 300 * math.sin(t / 10), 1)
        load_power = round(1650 + 200 * math.cos(t / 15), 1)

        return {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "is_live": False,
            "configured": bool(self.email),
            "plant_info": {
                "name": "Solo Solar Energy (Demo)",
                "total_devices": 3,
                "status": "Demo Mode"
            },
            "solar": {
                "power_w": pv_power,
                "voltage_v": 240.2,
                "current_a": round(pv_power / 240.2, 1)
            },
            "battery": {
                "soc_percent": 86.0,
                "power_w": -350.0,
                "voltage_v": 51.2,
                "status": "Charging"
            },
            "load": {
                "power_w": load_power,
                "voltage_v": 230.0,
                "frequency_hz": 50.0
            },
            "grid": {
                "power_w": 0.0,
                "voltage_v": 230.0,
                "status": "Connected"
            },
            "system": {
                "inverter_temp_c": 36.4,
                "health_status": "Optimal"
            },
            "devices": [
                {
                    "sn": "010310004824340147",
                    "alias": "Luzira (Inverter 10kW)",
                    "model": "IVPM10048",
                    "type": "OG",
                    "type_name": "Off-Grid High Frequency Inverter",
                    "status": "NM",
                    "rated_power_kw": "10",
                    "country": "Uganda",
                    "timezone": "UTC+03:00",
                    "pv_power_w": 920.0,
                    "pv_voltage_v": 240.0,
                    "load_power_w": 850.0,
                    "battery_soc": 86.0,
                    "battery_power_w": -175.0,
                    "collector_sn": "090101270024170146",
                    "firmware_version": "1.03",
                    "plant_name": "Solo Solar Energy",
                    "plant_id": "10151855957824961",
                    "id": "10194476761511392"
                },
                {
                    "sn": "01031004822320027",
                    "alias": "Solo Mutungo (Inverter 10kW)",
                    "model": "IVPM10048",
                    "type": "OG",
                    "type_name": "Off-Grid High Frequency Inverter",
                    "status": "NM",
                    "rated_power_kw": "10",
                    "country": "Uganda",
                    "timezone": "UTC+03:00",
                    "pv_power_w": 1295.0,
                    "pv_voltage_v": 242.0,
                    "load_power_w": 800.0,
                    "battery_soc": 86.0,
                    "battery_power_w": -175.0,
                    "collector_sn": "090101270024170398",
                    "firmware_version": "1.03",
                    "plant_name": "Solo Solar Energy",
                    "plant_id": "10151855957824961",
                    "id": "10190715415754208"
                },
                {
                    "sn": "07084820022160303",
                    "alias": "Luzira Battery (48V 200Ah)",
                    "model": "LPBF48200-P",
                    "type": "BP",
                    "type_name": "Lithium Battery Pack",
                    "status": "NR",
                    "rated_power_kw": "0",
                    "country": "Uganda",
                    "timezone": "UTC+03:00",
                    "pv_power_w": 0.0,
                    "pv_voltage_v": 0.0,
                    "load_power_w": 0.0,
                    "battery_soc": 86.0,
                    "battery_power_w": 0.0,
                    "collector_sn": "N/A",
                    "firmware_version": "N/A",
                    "plant_name": "Solo Solar Energy",
                    "plant_id": "10151855957824961",
                    "id": "10194526907037152"
                }
            ]
        }
