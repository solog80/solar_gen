document.addEventListener('DOMContentLoaded', () => {
  let powerChart = null;
  let currentDevices = [];

  // DOM Elements
  const plantTitle = document.getElementById('plantTitle');
  const deviceCountBadge = document.getElementById('deviceCountBadge');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const refreshBtn = document.getElementById('refreshBtn');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const deviceGrid = document.getElementById('deviceGrid');
  
  // Metric Elements
  const pvPower = document.getElementById('pvPower');
  const pvVoltage = document.getElementById('pvVoltage');
  const pvCurrent = document.getElementById('pvCurrent');
  
  const batterySoc = document.getElementById('batterySoc');
  const batteryProgressBar = document.getElementById('batteryProgressBar');
  const batteryStatus = document.getElementById('batteryStatus');
  const batteryPower = document.getElementById('batteryPower');
  const batteryVoltage = document.getElementById('batteryVoltage');
  
  const loadPower = document.getElementById('loadPower');
  const loadVoltage = document.getElementById('loadVoltage');
  const loadFreq = document.getElementById('loadFreq');
  
  const gridPower = document.getElementById('gridPower');
  const gridVoltage = document.getElementById('gridVoltage');
  const gridStatusText = document.getElementById('gridStatusText');
  const inverterTemp = document.getElementById('inverterTemp');
  
  // Footer Elements
  const plantNameFooter = document.getElementById('plantNameFooter');
  const accountEmail = document.getElementById('accountEmail');
  const lastUpdated = document.getElementById('lastUpdated');

  // Config Modal Elements
  const configModal = document.getElementById('configModal');
  const closeConfigBtn = document.getElementById('closeConfigBtn');
  const cancelConfigBtn = document.getElementById('cancelConfigBtn');
  const configForm = document.getElementById('configForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const modalMsg = document.getElementById('modalMsg');

  // Device Detail Modal Elements
  const deviceDetailModal = document.getElementById('deviceDetailModal');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const modalDeviceAlias = document.getElementById('modalDeviceAlias');
  const modalDeviceSn = document.getElementById('modalDeviceSn');
  const modalDeviceContent = document.getElementById('modalDeviceContent');

  // Initialize Chart
  function initChart() {
    const ctx = document.getElementById('powerChart').getContext('2d');
    
    const gradientPv = ctx.createLinearGradient(0, 0, 0, 300);
    gradientPv.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
    gradientPv.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    const gradientLoad = ctx.createLinearGradient(0, 0, 0, 300);
    gradientLoad.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
    gradientLoad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    powerChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Total Solar PV (W)',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: gradientPv,
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 3
          },
          {
            label: 'Total Load (W)',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: gradientLoad,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1f2937',
            titleColor: '#f3f4f6',
            bodyColor: '#9ca3af',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } }
          }
        }
      }
    });
  }

  // Fetch History Data
  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (powerChart && data) {
        powerChart.data.labels = data.map(d => d.time);
        powerChart.data.datasets[0].data = data.map(d => d.pv_power);
        powerChart.data.datasets[1].data = data.map(d => d.load_power);
        powerChart.update();
      }
    } catch (e) {
      console.error('History fetch error:', e);
    }
  }

  // Render Individual Device Cards
  function renderDevices(devices) {
    currentDevices = devices || [];
    if (!devices || devices.length === 0) {
      deviceGrid.innerHTML = `<p style="color: var(--text-muted);">No devices found.</p>`;
      return;
    }

    deviceGrid.innerHTML = devices.map(d => {
      const isBattery = d.type === 'BP';
      const tagClass = isBattery ? 'tag-battery' : 'tag-inverter';
      const typeLabel = isBattery ? 'Lithium Battery' : `Inverter (${d.model})`;

      return `
        <div class="device-card" data-sn="${d.sn}">
          <div class="device-card-header">
            <div>
              <span class="device-alias">${d.alias}</span>
              <div class="device-sn">SN: ${d.sn}</div>
            </div>
            <span class="device-tag ${tagClass}">${typeLabel}</span>
          </div>

          <div class="device-metric-row">
            <span class="label">Solar PV Power</span>
            <span class="val glow-amber">${Math.round(d.pv_power_w)} W</span>
          </div>

          <div class="device-metric-row">
            <span class="label">Battery SOC</span>
            <span class="val glow-emerald">${Math.round(d.battery_soc)}%</span>
          </div>

          <div class="device-metric-row">
            <span class="label">Collector Logger SN</span>
            <span class="val" style="font-size:0.75rem; color:#9ca3af;">${d.collector_sn || 'N/A'}</span>
          </div>

          <div class="inspect-btn">
            <span>View Full Device Details</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to open detail inspector
    document.querySelectorAll('.device-card').forEach(card => {
      card.addEventListener('click', () => {
        const sn = card.getAttribute('data-sn');
        const targetDev = currentDevices.find(d => d.sn === sn);
        if (targetDev) {
          openDeviceInspector(targetDev);
        }
      });
    });
  }

  // Open Dedicated Device Detail Inspector
  function openDeviceInspector(d) {
    modalDeviceAlias.textContent = d.alias;
    modalDeviceSn.textContent = `Serial Number: ${d.sn}`;

    const isBattery = d.type === 'BP';

    modalDeviceContent.innerHTML = `
      <div class="detail-stats-grid">
        <div class="detail-stat-box">
          <span class="lbl">PV Generation</span>
          <span class="val glow-amber">${Math.round(d.pv_power_w)} W</span>
        </div>
        <div class="detail-stat-box">
          <span class="lbl">Battery SOC</span>
          <span class="val glow-emerald">${Math.round(d.battery_soc)} %</span>
        </div>
        <div class="detail-stat-box">
          <span class="lbl">AC Load</span>
          <span class="val glow-cyan">${Math.round(d.load_power_w || 0)} W</span>
        </div>
        <div class="detail-stat-box">
          <span class="lbl">Rated Power</span>
          <span class="val">${d.rated_power_kw || '10'} kW</span>
        </div>
      </div>

      <table class="detail-props-table">
        <tr>
          <td>Device Alias</td>
          <td>${d.alias}</td>
        </tr>
        <tr>
          <td>Hardware Model</td>
          <td>${d.model} (${d.type_name || d.type})</td>
        </tr>
        <tr>
          <td>Device Type</td>
          <td>${isBattery ? 'Lithium Battery Pack (BP)' : 'Off-Grid Inverter (OG)'}</td>
        </tr>
        <tr>
          <td>Collector Wi-Fi Logger SN</td>
          <td>${d.collector_sn || 'N/A'}</td>
        </tr>
        <tr>
          <td>Inverter SN / InvDeviceSN</td>
          <td>${d.sn}</td>
        </tr>
        <tr>
          <td>Plant Name</td>
          <td>${d.plant_name || 'Solo Solar Energy'}</td>
        </tr>
        <tr>
          <td>Plant ID</td>
          <td>${d.plant_id || '10151855957824961'}</td>
        </tr>
        <tr>
          <td>Location & Timezone</td>
          <td>${d.country || 'Uganda'} (${d.timezone || 'UTC+03:00'})</td>
        </tr>
        <tr>
          <td>Firmware Version</td>
          <td>${d.firmware_version || '1.03'}</td>
        </tr>
        <tr>
          <td>Operational Status</td>
          <td><span style="color:#10b981; font-weight:700;">● Online (Normal)</span></td>
        </tr>
      </table>
    `;

    deviceDetailModal.classList.add('active');
  }

  // Fetch Telemetry Data
  async function fetchTelemetry() {
    try {
      refreshBtn.classList.add('spinning');
      const res = await fetch('/api/status');
      const data = await res.json();

      // Update Header & Plant Title
      if (data.plant_info) {
        plantTitle.childNodes[0].nodeValue = `${data.plant_info.name} `;
        deviceCountBadge.textContent = `${data.plant_info.total_devices || 3} Devices`;
        plantNameFooter.textContent = data.plant_info.name;
      }

      // Update Header Status Badge
      if (data.is_live) {
        statusBadge.className = 'status-badge live';
        statusText.textContent = 'Cloud Connected';
      } else {
        statusBadge.className = 'status-badge demo';
        statusText.textContent = data.configured ? 'Connecting...' : 'Demo Mode';
      }

      // Update Solar Metrics (Total Plant)
      pvPower.textContent = Math.round(data.solar.power_w).toLocaleString();
      pvVoltage.textContent = data.solar.voltage_v;
      pvCurrent.textContent = data.solar.current_a;

      // Update Battery Metrics
      batterySoc.textContent = Math.round(data.battery.soc_percent);
      batteryProgressBar.style.width = `${Math.min(100, Math.max(0, data.battery.soc_percent))}%`;
      batteryStatus.textContent = data.battery.status;
      batteryPower.textContent = Math.round(data.battery.power_w);
      batteryVoltage.textContent = data.battery.voltage_v;

      // Update Load Metrics
      loadPower.textContent = Math.round(data.load.power_w).toLocaleString();
      loadVoltage.textContent = data.load.voltage_v;
      loadFreq.textContent = data.load.frequency_hz;

      // Update Grid & Temp Metrics
      gridPower.textContent = Math.round(data.grid.power_w);
      gridVoltage.textContent = data.grid.voltage_v;
      gridStatusText.textContent = data.grid.status;
      inverterTemp.textContent = data.system.inverter_temp_c;

      // Render Individual Devices
      renderDevices(data.devices);

      // Update Footer
      accountEmail.textContent = data.configured ? 'solog80@gmail.com' : 'Not Configured';
      lastUpdated.textContent = data.timestamp.split(' ')[1] || data.timestamp;

    } catch (e) {
      console.error('Telemetry fetch error:', e);
    } finally {
      setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    }
  }

  // Modal Controls
  function openConfigModal() {
    configModal.classList.add('active');
    modalMsg.className = 'modal-msg';
    modalMsg.style.display = 'none';
  }
  function closeConfigModal() {
    configModal.classList.remove('active');
  }
  function closeDetailModal() {
    deviceDetailModal.classList.remove('active');
  }

  openConfigBtn.addEventListener('click', openConfigModal);
  closeConfigBtn.addEventListener('click', closeConfigModal);
  cancelConfigBtn.addEventListener('click', closeConfigModal);
  closeDetailModalBtn.addEventListener('click', closeDetailModal);

  refreshBtn.addEventListener('click', () => {
    fetchTelemetry();
    fetchHistory();
  });

  // Handle Credentials Submit
  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) return;

    saveConfigBtn.disabled = true;
    saveConfigBtn.textContent = 'Authenticating...';
    modalMsg.style.display = 'none';

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        modalMsg.className = 'modal-msg success';
        modalMsg.textContent = data.message;
        setTimeout(() => {
          closeConfigModal();
          fetchTelemetry();
        }, 1200);
      } else {
        modalMsg.className = 'modal-msg error';
        modalMsg.textContent = data.message;
      }
    } catch (err) {
      modalMsg.className = 'modal-msg error';
      modalMsg.textContent = 'Failed to communicate with dashboard server.';
    } finally {
      saveConfigBtn.disabled = false;
      saveConfigBtn.textContent = 'Save & Authenticate';
    }
  });

  // Start App
  initChart();
  fetchTelemetry();
  fetchHistory();

  // Auto-refresh every 10s
  setInterval(fetchTelemetry, 10000);
});
