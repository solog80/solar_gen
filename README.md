# ☀️ Felicity Solar Energy Dashboard & QNAP TimescaleDB Data House

High-performance **Go (Golang)** backend paired with a modern, glassmorphic **React 18 (TypeScript + Vite + TailwindCSS)** frontend for real-time telemetry, 24-hour power curves, multi-user authentication, and 2-year historical financial energy savings analytics backed by a **QNAP NAS TimescaleDB** data house.

---

## ✨ Features & Capabilities

* **⚡ Real-Time Multi-Device Tracking:** Concurrently polls and aggregates telemetry across multiple solar inverters and battery packs (**Luzira 10kW Inverter**, **Solo Mutungo 10kW Inverter**, and **Luzira Battery Pack**).
* **💰 QNAP NAS TimescaleDB Power Savings Engine:** Automatically logs 5-minute telemetry snapshots into hypertable `felicity_solar_telemetry` on QNAP NAS (`100.116.185.70:55439`). Calculates accumulated solar generation, house load offset, and financial savings in **UGX & USD** against the Umeme electricity tariff (UGX 890 / kWh).
* **📅 Historical Backfill & Deep Data Depth:** Synced over 2,200+ historical records back to **September 2024** (2 full years of historical data) directly from Shine Felicity Cloud API.
* **🔋 Dynamic 14S NMC Battery SOC Engine:** Calibrated Voltage-to-SOC curve for Incell `SLB48-250-146-21` Li-ion batteries when BMS is disconnected (`bmsFlagStr: Disconnected`). Renders a physical 5-dot LED battery indicator bar (e.g. 4/5 dots for Solo Mutungo @ 74.1%).
* **⚡ Net Battery Power & Current (Amps):** Computes active net battery charge/discharge wattages ($W$) and current in Amperes ($A$) across Solar PV, AC House Load, and Battery Storage.
* **📍 Location-Specific Single-Home Inspector Pages:** Click any location card to open its dedicated view with location-filtered TimescaleDB analytics and 24-hour time-series curves.
* **🗓️ Custom Date Range Picker & Period Breakdowns:** Select custom date ranges or quick presets (**Past 30 Days**, **This Month**, **Last Month**, **1 Year**, **All-Time 2024–2026**) with daily, weekly, and monthly bucket aggregations.
* **🔑 Multi-User Authentication & Admin Management:** Secure local dashboard user login (`dashboard_users` table in Postgres) with roles (`admin` / `viewer`). Server fetching runs silently in background using `.env` admin credentials without exposing Shine passwords.

---

## 🏗️ System Architecture

```
                                  ┌──────────────────────────────────────────────┐
                                  │      Shine Felicity Cloud API                │
                                  │   (shine-api.felicitysolar.com)              │
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTPS Snapshot Queries
                                                         ▼
┌─────────────────────────┐               ┌──────────────────────────────────────┐
│  React 18 Frontend      │  HTTP REST    │   Go (Golang) Backend Server         │
│  (TypeScript/Vite/Tail) │◄─────────────►│   (Port 8085, Goroutines Engine)     │
└─────────────────────────┘               └──────────────────────┬───────────────┘
                                                                 │ 5-Min Telemetry Logs
                                                                 ▼
                                          ┌──────────────────────────────────────┐
                                          │  QNAP NAS TimescaleDB Hypertable     │
                                          │  (100.116.185.70:55439 / analytics)   │
                                          └──────────────────────────────────────┘
```

---

## 🌐 API Endpoint Reference Catalog

### 1. Shine Felicity Cloud API (`https://shine-api.felicitysolar.com`)

| Endpoint Path | HTTP Method | Request Payload / Parameters | Description & Returned Data |
| :--- | :--- | :--- | :--- |
| **`/user/login`** | `POST` | `{"userName": "...", "password": "..."}` | Authenticates account and returns `bearerToken`, `token`, user ID, and expiration metadata. |
| **`/device/get_device_list`** | `POST` | `{"pageNum": 1, "pageSize": 50}` | Discovers all registered inverters (**Luzira**, **Solo Mutungo**), battery packs, and Wi-Fi dataloggers (`collectorSn`). |
| **`/device/get_device_snapshot`** | `POST` | `{"deviceSn": "...", "dateStr": "YYYY-MM-DD"}` | Core telemetry endpoint. Returns live/historical snapshots (`pvTotalPower`, `acTotalOutActPower`, `emsVoltage`, `acRInPower`, `acRInVolt`, `acRInFreq`, `inverterTempC`). |
| **`/device/get_device_energy_year`** | `POST` | `{"deviceSn": "...", "year": "YYYY"}` | Daily historical energy aggregation endpoint across monthly and yearly buckets. |
| **`/device/get_device_history`** | `POST` | `{"deviceSn": "...", "dateStr": "YYYY-MM-DD"}` | Internal historical time-series endpoint structure for raw datapoints. |
| **`/device/get_device_energy_month`** | `POST` | `{"deviceSn": "...", "month": "YYYY-MM"}` | Monthly energy generation breakdown structure. |
| **`/device/get_device_day_chart`** | `POST` | `{"deviceSn": "...", "dateStr": "YYYY-MM-DD"}` | 24-hour day chart generation and consumption power curves. |
| **`/plant/get_plant_energy`** | `POST` | `{"plantId": "..."}` | Plant-wide aggregated energy production totals across all inverters. |

---

### 2. Local Custom Dashboard REST API (`http://localhost:8085`)

| Endpoint Path | HTTP Method | Query Parameters | Description & Function |
| :--- | :--- | :--- | :--- |
| **`/api/status`** | `GET` | *None* | Returns live aggregated plant telemetry, active device list, solar output, house load, battery SOC, and AC utility grid status. |
| **`/api/history`** | `GET` | *None* | Returns 24-hour plant-wide time-series power points for Chart.js rendering. |
| **`/api/device/history`** | `GET` | `sn` *(device serial)* | Returns location-specific 24-hour time-series power points (PV, Load, Grid, Battery SOC). |
| **`/api/analytics`** | `GET` | `sn` *(optional)*<br>`start_date` *(optional)*<br>`end_date` *(optional)* | Queries QNAP TimescaleDB (`100.116.185.70:55439`) for accumulated Solar kWh, Load kWh, and financial savings (**UGX & USD**). |
| **`/api/breakdown`** | `GET` | `period` (`daily` \| `weekly` \| `monthly`)<br>`sn` *(optional)*<br>`start_date` *(optional)*<br>`end_date` *(optional)* | Returns period breakdown time buckets with Solar kWh, Load kWh, Grid kWh, and money saved. |
| **`/api/backfill`** | `GET` | `days` *(default: 30)* | Triggers historical Shine API backfill into QNAP NAS TimescaleDB hypertable (`felicity_solar_telemetry`). |
| **`/api/config`** | `POST` | *JSON body* | Updates Shine Felicity Cloud user credentials and triggers instant re-authentication. |
| **`/api/auth/login`** | `POST` | `{"username": "...", "password": "..."}` | Authenticates dashboard user accounts against `dashboard_users` table. |
| **`/api/auth/users`** | `GET` / `POST` / `DELETE` | `id` *(for DELETE)* | Multi-user account management (create, list, delete dashboard user accounts). |

---

## 🛠️ Quick Start & Setup

### 1. Prerequisites
* **Go** `1.21+` installed
* **Node.js** `18+` & `npm`
* **QNAP NAS TimescaleDB / PostgreSQL** instance running

### 2. Environment Configuration (`.env`)
Create a `.env` file in the root directory (refer to `.env.example`):
```env
FELICITY_CLOUD_EMAIL=your_email@example.com
FELICITY_CLOUD_PASSWORD=your_password
TIMESCALE_URL=postgres://postgres:password@100.116.185.70:55439/analytics?sslmode=disable
PORT=8085
JWT_SECRET=your_jwt_secret
```

### 3. Build & Run
```bash
# 1. Build React Frontend Assets
cd frontend
npm install
npm run build
cd ..

# 2. Compile & Run Go Backend Server
go build -o server main.go
./server
```

Open **[http://localhost:8085](http://localhost:8085)** in your browser. Default login accounts:
* **Admin:** `solo` / `solo2026`
* **Viewer:** `viewer` / `viewer123`

---

## 🔒 Cloudflare Zero Trust Tunnel Setup for QNAP NAS (Without Tailscale)

If you launch or deploy the dashboard backend outside your local network without Tailscale running, you can connect securely to your QNAP NAS TimescaleDB instance (`192.168.0.112:55439`) via a **Cloudflare Zero Trust Tunnel**.

### Step 1: Configure Ingress Rule on QNAP Cloudflare Tunnel
In your **Cloudflare Zero Trust Dashboard** (`Access` -> `Tunnels` -> Select your existing QNAP NAS Tunnel at `192.168.0.112`):
1. Click **Add Public Hostname**:
   * **Public Hostname:** `timescale.yourdomain.com` (or `solar-db.yourdomain.com`)
   * **Service Type:** `TCP`
   * **URL:** `192.168.0.112:55439` (or `localhost:55439` if container uses host networking)
2. Save the Ingress Rule.

### Step 2: Establish Client TCP Tunnel Proxy (On machine running Go Backend)
Because Postgres raw TCP traffic is encapsulated over WebSockets by Cloudflare Zero Trust, launch a local client TCP proxy using `cloudflared`:
```bash
cloudflared access tcp --hostname timescale.yourdomain.com --url localhost:55439
```

### Step 3: Update `.env` Connection URL
Set `TIMESCALE_URL` in `.env` depending on your connection method:

* **Via Cloudflare Zero Trust TCP Tunnel (Remote / Cloud / Without Tailscale):**
  ```env
  TIMESCALE_URL=postgres://postgres:becd1f3c85c65c97f57c8a4ee2c96c6c00266a19@localhost:55439/analytics?sslmode=disable
  ```
* **Via Local LAN (Direct QNAP NAS IP):**
  ```env
  TIMESCALE_URL=postgres://postgres:becd1f3c85c65c97f57c8a4ee2c96c6c00266a19@192.168.0.112:55439/analytics?sslmode=disable
  ```
* **Via Tailscale VPN:**
  ```env
  TIMESCALE_URL=postgres://postgres:becd1f3c85c65c97f57c8a4ee2c96c6c00266a19@100.116.185.70:55439/analytics?sslmode=disable
  ```

---

## 📄 License
MIT License. Developed for Solo Solar Energy Custom Monitoring & QNAP TimescaleDB Analytics Engine.
