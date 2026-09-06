# 🐧 QNAP NAS Backend Deployment Guide

This guide walks through deploying the pre-compiled static Go backend binary (`server_qnap_linux`) directly onto your **QNAP NAS** (`192.168.0.112`) so your custom Felicity Solar Dashboard runs 24/7 independently of your laptop.

---

## 📋 Requirements
* QNAP NAS LAN IP: `192.168.0.112`
* SSH access to QNAP NAS (`admin@192.168.0.112`) OR QNAP Container Station / File Station
* Port `8085` accessible on LAN

---

## 🚀 Step 1: Copy Files to QNAP NAS

From your Mac terminal, copy the statically-linked `server_qnap_linux` binary and `.env` file to your QNAP NAS storage folder (e.g. `/share/CACHEDEV1_DATA/solar_dashboard`):

```bash
# 1. SSH into QNAP to create directory
ssh admin@192.168.0.112 "mkdir -p /share/CACHEDEV1_DATA/solar_dashboard"

# 2. Copy the compiled Linux binary
scp /Users/solomacbookair/Documents/myApps/felicity_solar_dashboard/server_qnap_linux admin@192.168.0.112:/share/CACHEDEV1_DATA/solar_dashboard/server

# 3. Copy environment settings (.env)
scp /Users/solomacbookair/Documents/myApps/felicity_solar_dashboard/.env admin@192.168.0.112:/share/CACHEDEV1_DATA/solar_dashboard/.env
```

---

## 🏃 Step 2: Launch Server on QNAP NAS

### Option A: Via SSH Background Process (Quickest)
```bash
ssh admin@192.168.0.112
cd /share/CACHEDEV1_DATA/solar_dashboard
chmod +x server

# Start server in background using nohup
nohup ./server > server.log 2>&1 &
```

Verify it is running:
```bash
ps | grep server
curl http://localhost:8085/api/status
```

---

### Option B: Via QNAP Container Station / Docker Compose (Recommended 24/7)
Create a new Application in **QNAP Container Station** using the following Docker Compose config:

```yaml
version: '3.8'
services:
  solar_dashboard:
    image: alpine:latest
    container_name: solar_dashboard_backend
    restart: always
    network_mode: host
    working_dir: /app
    volumes:
      - /share/CACHEDEV1_DATA/solar_dashboard:/app
    command: /app/server
```

---

## 🔒 Step 3: Verify Cloudflare Tunnel Ingress

In your **Cloudflare Zero Trust Dashboard** (`Access` -> `Tunnels` -> Edit QNAP Tunnel):

* **Public Hostname:** `solar-analytics.solofx.net`
* **Service Type:** **`HTTP`**
* **URL:** `192.168.0.112:8085` (or `localhost:8085` if using host network mode)

---

## 🎉 Verification
Test your API from anywhere in the browser:
👉 **[https://solar-analytics.solofx.net/api/status](https://solar-analytics.solofx.net/api/status)**

Once responding with JSON telemetry, open **[https://solar.solofx.net](https://solar.solofx.net)** and enjoy your 24/7 live solar monitoring dashboard!
