package felicity

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	LoginURL          = "https://shine-api.felicitysolar.com/userlogin"
	DeviceListURL     = "https://shine-api.felicitysolar.com/device/list_device_all_type"
	DeviceSnapshotURL = "https://shine-api.felicitysolar.com/device/get_device_snapshot"
)

var EATLocation = time.FixedZone("EAT", 3*3600)

type Client struct {
	mu          sync.RWMutex
	configPath  string
	Email       string
	Password    string
	BearerToken string
	TokenExpiry float64
	httpClient  *http.Client
}

func NewClient(configDir string) *Client {
	cfgPath := filepath.Join(configDir, "config.json")
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &Client{
		configPath: cfgPath,
		httpClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: tr,
		},
	}
	client.LoadConfig()
	return client
}

func (c *Client) LoadConfig() {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := os.ReadFile(c.configPath)
	if err == nil {
		var cfg Config
		if err := json.Unmarshal(data, &cfg); err == nil {
			c.Email = cfg.Email
			c.Password = cfg.Password
			c.BearerToken = c.cleanToken(cfg.BearerToken)
			c.TokenExpiry = cfg.TokenExpiry
		}
	}

	if envEmail := os.Getenv("FELICITY_CLOUD_EMAIL"); envEmail != "" {
		c.Email = envEmail
	}
	if envPass := os.Getenv("FELICITY_CLOUD_PASSWORD"); envPass != "" {
		c.Password = envPass
	}
	if c.Email == "" {
		c.Email = "solog80@gmail.com"
	}
	if c.Password == "" {
		c.Password = "805605Love"
	}
}

func (c *Client) SaveConfig() {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg := Config{
		Email:       c.Email,
		Password:    c.Password,
		BearerToken: c.BearerToken,
		TokenExpiry: c.TokenExpiry,
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		log.Printf("Error marshaling config: %v", err)
		return
	}
	_ = os.MkdirAll(filepath.Dir(c.configPath), 0755)
	_ = os.WriteFile(c.configPath, data, 0644)
}

func (c *Client) cleanToken(token string) string {
	if token == "" {
		return ""
	}
	if strings.HasPrefix(token, "Bearer Bearer_") {
		return strings.Replace(token, "Bearer Bearer_", "Bearer_", 1)
	}
	if strings.HasPrefix(token, "Bearer Bearer ") {
		return strings.Replace(token, "Bearer Bearer ", "Bearer ", 1)
	}
	return token
}

func (c *Client) IsAuthenticated() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.BearerToken != "" && float64(time.Now().Unix()) < c.TokenExpiry
}

func (c *Client) Login(email, password string) bool {
	if email != "" {
		c.Email = email
	}
	if password != "" {
		c.Password = password
	}

	if c.Email == "" || c.Password == "" {
		log.Println("[Go felicity] Email or password missing")
		return false
	}

	log.Printf("[Go felicity] Authenticating with Felicity Cloud for %s...", c.Email)

	reqPayload := LoginRequest{
		UserName: c.Email,
		Password: c.Password,
	}
	bodyBytes, _ := json.Marshal(reqPayload)

	req, err := http.NewRequest("POST", LoginURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Printf("[Go felicity] Request creation error: %v", err)
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[Go felicity] HTTP Login error: %v", err)
		return false
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var loginResp LoginResponse
	if err := json.Unmarshal(respBytes, &loginResp); err != nil {
		log.Printf("[Go felicity] JSON decode error: %v", err)
		return false
	}

	log.Printf("[Go felicity] Login Response Code: %d", loginResp.Code)

	var extractedToken string
	if loginResp.Token != "" {
		extractedToken = loginResp.Token
	} else if dataMap, ok := loginResp.Data.(map[string]interface{}); ok {
		if t, ok := dataMap["token"].(string); ok {
			extractedToken = t
		} else if t, ok := dataMap["accessToken"].(string); ok {
			extractedToken = t
		} else if t, ok := dataMap["authorization"].(string); ok {
			extractedToken = t
		}
	}

	if extractedToken != "" {
		c.mu.Lock()
		c.BearerToken = c.cleanToken(extractedToken)
		c.TokenExpiry = float64(time.Now().Unix() + 86400) // 24h
		c.mu.Unlock()

		c.SaveConfig()
		log.Println("[Go felicity] Authentication successful!")
		return true
	}

	log.Printf("[Go felicity] Login failed: %s", loginResp.Message)
	return false
}

func (c *Client) FetchDevices() []DeviceRawItem {
	if !c.IsAuthenticated() && !c.Login("", "") {
		return nil
	}

	c.mu.RLock()
	token := c.BearerToken
	c.mu.RUnlock()

	reqBody := []byte(`{"pageNum": 1, "pageSize": 50}`)
	req, err := http.NewRequest("POST", DeviceListURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[Go felicity] Error fetching device list: %v", err)
		return nil
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var devResp DeviceListResponse
	if err := json.Unmarshal(respBytes, &devResp); err != nil {
		log.Printf("[Go felicity] JSON unmarshal dev list error: %v", err)
		return nil
	}

	log.Printf("[Go felicity] Discovered %d device(s) in account via Go client", len(devResp.Data.DataList))
	return devResp.Data.DataList
}

func (c *Client) FetchDeviceSnapshot(deviceSN string) map[string]interface{} {
	return c.FetchDeviceSnapshotForDate(deviceSN, time.Now().In(EATLocation).Format("2006-01-02"))
}

func (c *Client) FetchDeviceSnapshotForDate(deviceSN string, dateStr string) map[string]interface{} {
	c.mu.RLock()
	token := c.BearerToken
	c.mu.RUnlock()

	reqBody, _ := json.Marshal(map[string]string{
		"deviceSn": deviceSN,
		"dateStr":  dateStr,
	})
	req, err := http.NewRequest("POST", DeviceSnapshotURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[Go felicity] Error fetching snapshot for %s on %s: %v", deviceSN, dateStr, err)
		return nil
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var snapResp DeviceSnapshotResponse
	if err := json.Unmarshal(respBytes, &snapResp); err == nil {
		return snapResp.Data
	}
	return nil
}

// --- Battery State-of-Charge (SOC) engine ---------------------------------
//
// The Felicity Shine API exposes a BMS-reported SOC (battSoc/emsSoc/emsSocAvg)
// which is authoritative and is preferred whenever present (values <= 1 are
// "no data" sentinels). When the BMS reports no usable SOC - for example an
// offline pack, or an inverter that only mirrors the EMS bus - we fall back to
// estimating SOC from the measured pack voltage.
//
// The voltage->SOC relationship depends on the cell chemistry and the number of
// series cells in the pack, so the estimate is keyed by device model. Unknown
// models deliberately return "not available" instead of a fabricated number.

// BatteryModelSpec describes the electrical characteristics of a battery pack.
type BatteryModelSpec struct {
	CellCount int        // number of series cells
	Chemistry string     // "LiFePO4", "NMC", ...
	RatedAh   float64    // nominal capacity (informational)
	RatedWh   float64    // nominal energy, used to weight parallel packs
	Curve     []socPoint // optional model-specific pack-voltage curve
}

// socPoint is a single (voltage, SOC%) anchor on a curve, ordered by ascending voltage.
type socPoint struct {
	v   float64
	soc float64
}

// cellSocCurves holds per-cell voltage -> SOC anchor points for each supported
// chemistry. Used when a model does not define its own pack-voltage curve.
var cellSocCurves = map[string][]socPoint{
	// 16S LiFePO4 (LFP): nominal 3.2 V/cell, full ~3.45-3.55 V/cell (56.7 V pack).
	"LiFePO4": {
		{2.50, 0}, {3.00, 7}, {3.10, 10}, {3.20, 20}, {3.25, 35},
		{3.28, 55}, {3.30, 75}, {3.32, 90}, {3.35, 97}, {3.45, 100},
	},
	// Li-ion NMC: nominal 3.7 V/cell, full ~4.20 V/cell.
	"NMC": {
		{3.00, 0}, {3.30, 5}, {3.50, 15}, {3.60, 30}, {3.70, 50},
		{3.85, 75}, {4.00, 90}, {4.10, 97}, {4.20, 100},
	},
}

// slb48250Curve is the pack-voltage -> SOC curve for the Incell SLB48-250-146-21
// (14S Li-ion), calibrated to the pack's own 5-dot LED indicator bands:
//
//	1 dot  ~47.0-50.0 V | 2 dots ~50.0-52.5 V | 3 dots ~52.5-54.2 V
//	4 dots ~54.2-57.0 V | 5 dots ~57.0-58.8 V
var slb48250Curve = []socPoint{
	{40.0, 0}, {47.0, 15}, {50.0, 35}, {52.5, 55}, {54.2, 72}, {57.0, 92}, {58.8, 100},
}

// batteryModelRegistry maps battery model strings to their specs. Only models
// listed here can be estimated from voltage; everything else returns N/A when
// the BMS does not report an SOC.
var batteryModelRegistry = map[string]BatteryModelSpec{
	"FLA48500TG2":      {CellCount: 16, Chemistry: "LiFePO4", RatedAh: 500, RatedWh: 25000}, // Mubende 48V/500Ah
	"LPBF48200-P":      {CellCount: 16, Chemistry: "LiFePO4", RatedAh: 200, RatedWh: 10000}, // Felicity 48V/200Ah
	"SLB48-250-146-21": {CellCount: 14, Chemistry: "NMC", RatedAh: 250, RatedWh: 12700, Curve: slb48250Curve}, // Incell 48V/250Ah
}

// batteryPackSpec describes a battery model and how many units are deployed.
type batteryPackSpec struct {
	Model string
	Count int
}

// deviceBatteryBanks maps a device serial number to the battery bank physically
// wired to it, for sites where the individual BMS packs are not exposed as their
// own devices on the Shine API. The shared inverter DC-bus voltage is interpreted
// against each pack's own curve, then combined by rated energy.
var deviceBatteryBanks = map[string][]batteryPackSpec{
	// Solo Mutungo: 2 x Incell SLB48-250-146-21 in parallel.
	"01031004822320027": {{Model: "SLB48-250-146-21", Count: 2}},
	// Luzira: 1 x Incell SLB48-250-146-21 + 1 x Felicity LPBF48200-P in parallel.
	"010310004824340147": {
		{Model: "SLB48-250-146-21", Count: 1},
		{Model: "LPBF48200-P", Count: 1},
	},
}

func lookupBatteryModel(model string) (BatteryModelSpec, bool) {
	key := strings.ToUpper(strings.TrimSpace(model))
	if key == "" {
		return BatteryModelSpec{}, false
	}
	if spec, ok := batteryModelRegistry[key]; ok {
		return spec, true
	}
	// Tolerate revision/hardware suffixes on the model string.
	for prefix, spec := range batteryModelRegistry {
		if strings.HasPrefix(key, prefix) {
			return spec, true
		}
	}
	return BatteryModelSpec{}, false
}

// EstimateBankSOC returns the combined State-of-Charge for a device's battery
// bank from the shared DC-bus voltage. When the device itself is a known battery
// its own curve is used; otherwise a bank configured in deviceBatteryBanks is
// evaluated pack-by-pack and combined by rated energy (parallel packs share
// voltage but sit at different SOC on their own curves). Returns (0, false) when
// nothing can be estimated, so callers can render "N/A".
func EstimateBankSOC(deviceModel, deviceSN string, voltage float64) (float64, bool) {
	if _, ok := lookupBatteryModel(deviceModel); ok {
		return EstimateSOCFromVoltage(deviceModel, voltage)
	}
	packs, ok := deviceBatteryBanks[strings.ToUpper(strings.TrimSpace(deviceSN))]
	if !ok || len(packs) == 0 {
		return 0, false
	}
	totalWh := 0.0
	weighted := 0.0
	for _, pack := range packs {
		est, ok := EstimateSOCFromVoltage(pack.Model, voltage)
		if !ok {
			continue
		}
		spec, ok := lookupBatteryModel(pack.Model)
		if !ok {
			continue
		}
		count := pack.Count
		if count < 1 {
			count = 1
		}
		wh := spec.RatedWh * float64(count)
		if wh <= 0 {
			continue
		}
		weighted += est * wh
		totalWh += wh
	}
	if totalWh <= 0 {
		return 0, false
	}
	return weighted / totalWh, true
}

func interpolateCurve(curve []socPoint, v float64) (float64, bool) {
	if len(curve) < 2 {
		return 0, false
	}
	if v <= curve[0].v {
		return curve[0].soc, true
	}
	if v >= curve[len(curve)-1].v {
		return curve[len(curve)-1].soc, true
	}
	for i := 1; i < len(curve); i++ {
		if v <= curve[i].v {
			lo, hi := curve[i-1], curve[i]
			frac := (v - lo.v) / (hi.v - lo.v)
			return lo.soc + frac*(hi.soc-lo.soc), true
		}
	}
	return curve[len(curve)-1].soc, true
}

// EstimateSOCFromVoltage returns a State-of-Charge estimate (0-100%) derived
// from the pack voltage for a known battery model, plus a validity flag. A
// model-specific curve takes precedence, otherwise the chemistry curve is
// applied per cell. It returns (0, false) for unknown models or unusable
// voltages so callers can render "N/A" instead of a fabricated percentage.
func EstimateSOCFromVoltage(model string, packVoltage float64) (float64, bool) {
	spec, ok := lookupBatteryModel(model)
	if !ok || spec.CellCount <= 0 || packVoltage <= 0 {
		return 0, false
	}
	if len(spec.Curve) >= 2 {
		return interpolateCurve(spec.Curve, packVoltage)
	}
	curve, ok := cellSocCurves[spec.Chemistry]
	if !ok || len(curve) < 2 {
		return 0, false
	}
	return interpolateCurve(curve, packVoltage/float64(spec.CellCount))
}

func (c *Client) GetTelemetry() TelemetryResponse {
	if c.IsAuthenticated() || c.Login("", "") {
		rawDevices := c.FetchDevices()
		if len(rawDevices) > 0 {
			var wg sync.WaitGroup
			snapshots := make(map[string]map[string]interface{})
			var snapMu sync.Mutex

			for _, dev := range rawDevices {
				if dev.DeviceSN != "" {
					wg.Add(1)
					go func(sn string) {
						defer wg.Done()
						snap := c.FetchDeviceSnapshot(sn)
						if snap != nil {
							snapMu.Lock()
							snapshots[sn] = snap
							snapMu.Unlock()
						}
					}(dev.DeviceSN)
				}
			}
			wg.Wait()

			var deviceItems []DeviceItem
			totalPV := 0.0
			totalPVCurrent := 0.0
			var pvVoltList []float64
			var loadVoltList []float64
			var loadFreqList []float64
			var gridVoltList []float64
			totalLoad := 0.0
			totalBatPower := 0.0
			totalGridPower := 0.0
			maxTemp := 0.0
			var maxBPSoc float64
			var bpSocList []float64
			var socList []float64
			var batVoltList []float64
			plantName := rawDevices[0].PlantName
			if plantName == "" {
				plantName = "Solo Solar Energy"
			}

			for _, dev := range rawDevices {
				sn := dev.DeviceSN
				alias := dev.Alias
				if alias == "" {
					alias = dev.DeviceModel
				}
				if alias == "" {
					alias = sn
				}

				pvDirect := parseFloat(dev.PvTotalPower)

				snap := snapshots[sn]
				devPV := pvDirect
				devLoad := 0.0
				devBatPower := 0.0
				devSoc := 0.0
				devSocValid := false
				devBatVolt := 0.0
				devTemp := 36.5
				devVPV := 240.0
				devPVCurrent := 0.0

				devGridPower := 0.0
				devGridVolt := 0.0
				devLoadVolt := 230.0
				devLoadFreq := 50.0

				if snap != nil {
					// Parse PV Power
					if v, ok := snap["pvTotalPower"]; ok && v != nil {
						devPV = parseFloat(v)
					} else if v, ok := snap["pvPower"]; ok && v != nil {
						devPV = parseFloat(v)
					}

					// Parse AC Load Power
					if v, ok := snap["acTotalOutActPower"]; ok && v != nil {
						devLoad = parseFloat(v)
					} else if v, ok := snap["acROutPower"]; ok && v != nil {
						devLoad = parseFloat(v)
					}

					if v, ok := snap["acROutVolt"]; ok && v != nil && parseFloat(v) > 0 {
						devLoadVolt = parseFloat(v)
					}

					devLoadCurrent := 0.0
					if v, ok := snap["acROutCurr"]; ok && v != nil && parseFloat(v) > 0 {
						devLoadCurrent = parseFloat(v)
					} else if devLoadVolt > 0 {
						devLoadCurrent = math.Round((devLoad / devLoadVolt)*10) / 10
					}

					if v, ok := snap["acROutFreq"]; ok && v != nil && parseFloat(v) > 0 {
						devLoadFreq = parseFloat(v)
					}

					// Parse Grid Input Power & Voltage directly from raw telemetry
					if v, ok := snap["acRInPower"]; ok && v != nil {
						devGridPower = parseFloat(v)
					} else if v, ok := snap["acTtlInpower"]; ok && v != nil {
						devGridPower = parseFloat(v)
					} else if v, ok := snap["gridInputPower"]; ok && v != nil {
						devGridPower = parseFloat(v)
					} else if v, ok := snap["gridPower"]; ok && v != nil {
						devGridPower = parseFloat(v)
					}

					devGridCurr := 0.0
					if v, ok := snap["acRInCurr"]; ok && v != nil {
						devGridCurr = parseFloat(v)
					}

					if v, ok := snap["acRInVolt"]; ok && v != nil {
						devGridVolt = parseFloat(v)
					} else if v, ok := snap["gridVoltage"]; ok && v != nil {
						devGridVolt = parseFloat(v)
					}

					// Calculate Grid Current if missing and Grid Power is positive
					if devGridCurr == 0 && devGridPower > 0 && devGridVolt > 0 {
						devGridCurr = math.Round((devGridPower/devGridVolt)*10) / 10
					}

					// Ensure non-negative grid power
					if devGridPower < 0 {
						devGridPower = 0.0
					}

					// Parse Battery Voltage
					if v, ok := snap["emsVoltage"]; ok && v != nil {
						devBatVolt = parseFloat(v)
					} else if v, ok := snap["battVolt"]; ok && v != nil {
						devBatVolt = parseFloat(v)
					}

					// Parse Battery SOC directly from raw telemetry (battSoc, emsSoc, emsSocAvg).
					// Values <= 1 are "no data" sentinels, not real percentages.
					if v, ok := snap["battSoc"]; ok && v != nil && parseFloat(v) > 1 {
						devSoc = parseFloat(v)
						devSocValid = true
					} else if v, ok := snap["emsSoc"]; ok && v != nil && parseFloat(v) > 1 {
						devSoc = parseFloat(v)
						devSocValid = true
					} else if v, ok := snap["emsSocAvg"]; ok && v != nil && parseFloat(v) > 1 {
						devSoc = parseFloat(v)
						devSocValid = true
					}

					// Fall back to a model-aware voltage estimate only when the BMS reported no
					// usable SOC and the device is not an external MPPT controller. Unknown models
					// leave devSocValid false so the UI shows N/A instead of a fabricated value.
					if !devSocValid && devBatVolt > 0 && dev.DeviceType != "MT" {
						if est, ok := EstimateBankSOC(dev.DeviceModel, dev.DeviceSN, devBatVolt); ok {
							devSoc = math.Round(est*10) / 10
							devSocValid = true
						}
					}

					// Parse raw Battery Power (Watts) from telemetry
					rawBatPower := 0.0
					if v, ok := snap["emsPower"]; ok && v != nil && parseFloat(v) != 0 {
						rawBatPower = math.Abs(parseFloat(v))
					} else if v, ok := snap["battPower"]; ok && v != nil && parseFloat(v) != 0 {
						rawBatPower = math.Abs(parseFloat(v))
					} else if devPV > 0 || devLoad > 0 {
						rawBatPower = math.Round(math.Abs(devLoad-devPV)*10) / 10
					}

					// Parse Battery Current (Amps) directly from raw telemetry (supporting negative values from Shine API)
					devBatCurrent := 0.0
					if v, ok := snap["emsCurrent"]; ok && v != nil && math.Abs(parseFloat(v)) > 0 {
						devBatCurrent = math.Abs(parseFloat(v))
					} else if v, ok := snap["battCurr"]; ok && v != nil && math.Abs(parseFloat(v)) > 0 {
						devBatCurrent = math.Abs(parseFloat(v))
					} else if devBatVolt > 0 && rawBatPower > 0 {
						devBatCurrent = math.Round((rawBatPower / devBatVolt)*10) / 10
					}

					// Set battery power sign: Positive = Discharging, Negative = Charging
					if devLoad > (devPV + devGridPower + 5.0) {
						// House load exceeds generation -> Battery is DISCHARGING
						devBatPower = math.Abs(rawBatPower)
					} else if (devPV + devGridPower) > (devLoad + 5.0) {
						// Generation exceeds house load -> Battery is CHARGING
						devBatPower = -1.0 * math.Abs(rawBatPower)
					} else {
						// Near balance -> fallback to raw emsCurrent sign if present
						if v, ok := snap["emsCurrent"]; ok && v != nil {
							emsI := parseFloat(v)
							if emsI < 0 {
								// Negative emsCurrent in Felicity API indicates Discharging
								devBatPower = math.Abs(rawBatPower)
							} else if emsI > 0 {
								devBatPower = -1.0 * math.Abs(rawBatPower)
							} else {
								devBatPower = 0.0
							}
						} else {
							devBatPower = 0.0
						}
					}

					// Fallback calculation for battery current if missing
					if devBatCurrent == 0 && devBatVolt > 0 && math.Abs(devBatPower) > 0 {
						devBatCurrent = math.Round((math.Abs(devBatPower) / devBatVolt)*10) / 10
					}

					// Parse PV Voltage first from raw telemetry
					if v, ok := snap["pvVolt"]; ok && v != nil && parseFloat(v) > 0 {
						devVPV = parseFloat(v)
					}

					// Parse PV Current (Amps) directly from raw telemetry (pvInCurr)
					if v, ok := snap["pvInCurr"]; ok && v != nil && parseFloat(v) > 0 {
						devPVCurrent = parseFloat(v)
					} else if v, ok := snap["pvCurr"]; ok && v != nil && parseFloat(v) > 0 {
						devPVCurrent = parseFloat(v)
					} else if devVPV > 0 {
						devPVCurrent = math.Round((devPV / devVPV)*10) / 10
					}

					// Parse Temperature
					if v, ok := snap["temperature"]; ok && v != nil {
						devTemp = parseFloat(v)
					}

					// Parse BMS Cell Telemetry for Battery Packs & Systems
					var cellVolts []float64
					for i := 1; i <= 16; i++ {
						key := "cellVolt" + strconv.Itoa(i)
						if v, ok := snap[key]; ok && v != nil {
							mv := parseFloat(v)
							if mv > 0 {
								valV := mv
								if mv > 100 {
									valV = math.Round((mv/1000.0)*1000) / 1000.0
								}
								cellVolts = append(cellVolts, valV)
							}
						}
					}
					if len(cellVolts) == 0 {
						if list, ok := snap["bmsVoltageList"].([]interface{}); ok {
							for _, item := range list {
								mv := parseFloat(item)
								if mv > 0 {
									valV := mv
									if mv > 100 {
										valV = math.Round((mv/1000.0)*1000) / 1000.0
									}
									cellVolts = append(cellVolts, valV)
								}
							}
						}
					}

					var cellTemps []float64
					for i := 1; i <= 4; i++ {
						key := "cellTemp" + strconv.Itoa(i)
						if v, ok := snap[key]; ok && v != nil {
							cellTemps = append(cellTemps, parseFloat(v))
						}
					}
					if len(cellTemps) == 0 {
						if list, ok := snap["cellTempList"].([]interface{}); ok {
							for _, item := range list {
								t := parseFloat(item)
								if t > -10 && t < 100 {
									cellTemps = append(cellTemps, t)
								}
							}
						}
					}

					maxCellMV := 0.0
					if v, ok := snap["maxVoltage2bms"]; ok && v != nil {
						maxCellMV = parseFloat(v)
					}
					minCellMV := 0.0
					if v, ok := snap["minVoltage2bms"]; ok && v != nil {
						minCellMV = parseFloat(v)
					}

					maxCellNum := 0
					if v, ok := snap["maxVoltageNum2bms"]; ok && v != nil {
						maxCellNum = int(parseFloat(v))
					}
					minCellNum := 0
					if v, ok := snap["minVoltageNum2bms"]; ok && v != nil {
						minCellNum = int(parseFloat(v))
					}

					soh := 0.0
					if v, ok := snap["emsSoh"]; ok && v != nil {
						soh = parseFloat(v)
					} else if v, ok := snap["battSoh"]; ok && v != nil {
						soh = parseFloat(v)
					}

					remKWh := 0.0
					if v, ok := snap["remainingBatteryEnergy"]; ok && v != nil {
						remKWh = parseFloat(v)
					}

					heatStat := ""
					if v, ok := snap["heatStatusStr"]; ok && v != nil {
						if str, ok := v.(string); ok {
							heatStat = str
						}
					}

					typeName := "Hybrid Solar Inverter"
					if dev.DeviceType == "BP" {
						typeName = "Lithium Battery Pack"
					}

					deviceItems = append(deviceItems, DeviceItem{
						SN:               sn,
						Alias:            alias,
						Model:            dev.DeviceModel,
						Type:             dev.DeviceType,
						TypeName:         typeName,
						Status:           dev.Status,
						RatedPowerKW:     dev.RatedPower,
						Country:          dev.CountryName,
						TimeZone:         dev.TimeZone,
						PvPowerW:         devPV,
						PvVoltageV:       devVPV,
						PvCurrentA:       devPVCurrent,
						LoadPowerW:       devLoad,
						LoadCurrentA:     devLoadCurrent,
						BatterySoc:       devSoc,
						BatterySocValid:  devSocValid,
						BatteryPowerW:    devBatPower,
						BatteryCurrentA:  devBatCurrent,
						BatteryVoltageV:  devBatVolt,
						GridPowerW:       devGridPower,
						GridVoltageV:     devGridVolt,
						CollectorSN:      dev.CollectorSN,
						FirmwareVersion:  dev.ModuleVersion,
						PlantName:        dev.PlantName,
						PlantID:          dev.PlantID,
						ID:               dev.ID,
						CellVoltages:     cellVolts,
						CellTemps:        cellTemps,
						MaxCellVoltMV:    maxCellMV,
						MinCellVoltMV:    minCellMV,
						MaxCellNum:       maxCellNum,
						MinCellNum:       minCellNum,
						SOHPercent:       soh,
						RemainingKWh:     remKWh,
						HeatStatus:       heatStat,
					})
				} else if est, ok := EstimateBankSOC(dev.DeviceModel, dev.DeviceSN, devBatVolt); ok {
					devSoc = math.Round(est*10) / 10
					devSocValid = true
				}

				if dev.DeviceType == "BP" {
					if devSocValid {
						bpSocList = append(bpSocList, devSoc)
						if devSoc > maxBPSoc {
							maxBPSoc = devSoc
						}
						socList = append(socList, devSoc)
						if devBatVolt > 0 {
							batVoltList = append(batVoltList, devBatVolt)
						}
					}
				} else {
					totalPV += devPV
					totalLoad += devLoad
					totalBatPower += devBatPower
					totalGridPower += devGridPower
					totalPVCurrent += devPVCurrent
					if devVPV > 0 {
						pvVoltList = append(pvVoltList, devVPV)
					}
					if devLoadVolt > 0 {
						loadVoltList = append(loadVoltList, devLoadVolt)
					}
					if devLoadFreq > 0 {
						loadFreqList = append(loadFreqList, devLoadFreq)
					}
					if devGridVolt > 0 {
						gridVoltList = append(gridVoltList, devGridVolt)
					}
					if devSocValid && dev.DeviceType != "MT" {
						bpSocList = append(bpSocList, devSoc)
						socList = append(socList, devSoc)
						if devBatVolt > 0 {
							batVoltList = append(batVoltList, devBatVolt)
						}
					}
				}

				if devTemp > maxTemp {
					maxTemp = devTemp
				}
			}

			var primaryBPSoc float64
			for _, dev := range deviceItems {
				if dev.Type == "BP" && dev.BatterySocValid {
					if primaryBPSoc == 0 || strings.Contains(strings.ToLower(dev.Alias), "1") {
						primaryBPSoc = dev.BatterySoc
						if strings.Contains(strings.ToLower(dev.Alias), "1") {
							break
						}
					}
				}
			}

			avgSOC := 0.0
			socValid := false
			if primaryBPSoc > 0 {
				avgSOC = primaryBPSoc
				socValid = true
			} else if len(bpSocList) > 0 {
				sum := 0.0
				for _, s := range bpSocList {
					sum += s
				}
				avgSOC = math.Round((sum/float64(len(bpSocList)))*10) / 10
				socValid = true
			} else if len(socList) > 0 {
				sum := 0.0
				for _, s := range socList {
					sum += s
				}
				avgSOC = math.Round((sum/float64(len(socList)))*10) / 10
				socValid = true
			}

			avgBatVolt := 0.0
			if len(batVoltList) > 0 {
				sumV := 0.0
				for _, v := range batVoltList {
					sumV += v
				}
				avgBatVolt = math.Round((sumV/float64(len(batVoltList)))*100) / 100
			}

			avgPVVolt := 120.0
			if len(pvVoltList) > 0 {
				sumPVV := 0.0
				for _, v := range pvVoltList {
					sumPVV += v
				}
				avgPVVolt = math.Round((sumPVV/float64(len(pvVoltList)))*10) / 10
			}

			avgLoadVolt := 230.0
			if len(loadVoltList) > 0 {
				sumLV := 0.0
				for _, v := range loadVoltList {
					sumLV += v
				}
				avgLoadVolt = math.Round((sumLV/float64(len(loadVoltList)))*10) / 10
			}

			avgLoadFreq := 50.0
			if len(loadFreqList) > 0 {
				sumLF := 0.0
				for _, v := range loadFreqList {
					sumLF += v
				}
				avgLoadFreq = math.Round((sumLF/float64(len(loadFreqList)))*10) / 10
			}

			avgGridVolt := 0.0
			if len(gridVoltList) > 0 {
				sumGV := 0.0
				for _, v := range gridVoltList {
					sumGV += v
				}
				avgGridVolt = math.Round((sumGV/float64(len(gridVoltList)))*10) / 10
			}

			gridStatus := "Disconnected"
			if avgGridVolt > 90.0 || totalGridPower > 0 {
				gridStatus = "Connected"
				if avgGridVolt == 0 {
					avgGridVolt = 230.0
				}
			}

			finalBatPower := totalBatPower
			batStatus := "Idle"
			if finalBatPower < -10.0 {
				batStatus = "Charging"
			} else if finalBatPower > 10.0 {
				batStatus = "Discharging"
			} else {
				netBatPower := (totalPV + totalGridPower) - totalLoad
				if netBatPower > 10.0 {
					batStatus = "Charging"
					finalBatPower = -1.0 * math.Round(netBatPower*10) / 10
				} else if netBatPower < -10.0 {
					batStatus = "Discharging"
					finalBatPower = math.Round(math.Abs(netBatPower)*10) / 10
				}
			}

			var resp TelemetryResponse
			resp.Timestamp = time.Now().In(EATLocation).Format("2006-01-02 15:04:05")
			resp.IsLive = true
			resp.Configured = true
			resp.PlantInfo.Name = plantName
			resp.PlantInfo.TotalDevices = len(rawDevices)
			resp.PlantInfo.Status = "Normal Operation"

			resp.Solar.PowerW = math.Round(totalPV*10) / 10
			resp.Solar.VoltageV = avgPVVolt
			resp.Solar.CurrentA = math.Round(totalPVCurrent*10) / 10

			resp.Battery.SocPercent = avgSOC
			resp.Battery.SocValid = socValid
			resp.Battery.PowerW = finalBatPower
			resp.Battery.VoltageV = avgBatVolt
			resp.Battery.Status = batStatus

			resp.Load.PowerW = math.Round(totalLoad*10) / 10
			resp.Load.VoltageV = avgLoadVolt
			resp.Load.FrequencyHz = avgLoadFreq

			resp.Grid.PowerW = math.Round(totalGridPower*10) / 10
			resp.Grid.VoltageV = avgGridVolt
			resp.Grid.Status = gridStatus

			resp.System.InverterTempC = maxTemp
			if maxTemp == 0 {
				resp.System.InverterTempC = 36.5
			}
			resp.System.HealthStatus = "Optimal"
			resp.Devices = deviceItems

			return resp
		}
	}

	return c.GetPreviewTelemetry()
}

func (c *Client) GetPreviewTelemetry() TelemetryResponse {
	t := float64(time.Now().Unix())
	pvPower := math.Round((2215.0+300.0*math.Sin(t/10.0))*10) / 10
	loadPower := math.Round((1650.0+200.0*math.Cos(t/15.0))*10) / 10
	batVolt := 53.2
	calcSOC := 74.0 // demo value; preview telemetry has no live BMS data

	var resp TelemetryResponse
	resp.Timestamp = time.Now().Format("2006-01-02 15:04:05")
	resp.IsLive = false
	resp.Configured = c.Email != ""
	resp.PlantInfo.Name = "Solo Solar Energy (Go Preview)"
	resp.PlantInfo.TotalDevices = 3
	resp.PlantInfo.Status = "Demo Mode"

	resp.Solar.PowerW = pvPower
	resp.Solar.VoltageV = 240.2
	resp.Solar.CurrentA = math.Round((pvPower/240.2)*10) / 10

	resp.Battery.SocPercent = calcSOC
	resp.Battery.SocValid = true
	resp.Battery.PowerW = -350.0
	resp.Battery.VoltageV = batVolt
	resp.Battery.Status = "Charging"

	resp.Load.PowerW = loadPower
	resp.Load.VoltageV = 230.0
	resp.Load.FrequencyHz = 50.0

	resp.Grid.PowerW = 0.0
	resp.Grid.VoltageV = 230.0
	resp.Grid.Status = "Connected"

	resp.System.InverterTempC = 36.4
	resp.System.HealthStatus = "Optimal"

	resp.Devices = []DeviceItem{
		{
			SN:              "010310004824340147",
			Alias:           "Luzira (Inverter 10kW)",
			Model:           "IVPM10048",
			Type:            "OG",
			TypeName:        "Off-Grid High Frequency Inverter",
			Status:          "NM",
			RatedPowerKW:    "10",
			Country:         "Uganda",
			TimeZone:        "UTC+03:00",
			PvPowerW:        920.0,
			PvVoltageV:      240.0,
			LoadPowerW:      850.0,
			BatterySoc:      calcSOC,
			BatterySocValid: true,
			BatteryPowerW:   -175.0,
			CollectorSN:     "090101270024170146",
			FirmwareVersion: "1.03",
			PlantName:       "Solo Solar Energy",
			PlantID:         "10151855957824961",
			ID:              "10194476761511392",
		},
		{
			SN:              "01031004822320027",
			Alias:           "Solo Mutungo (Inverter 10kW)",
			Model:           "IVPM10048",
			Type:            "OG",
			TypeName:        "Off-Grid High Frequency Inverter",
			Status:          "NM",
			RatedPowerKW:    "10",
			Country:         "Uganda",
			TimeZone:        "UTC+03:00",
			PvPowerW:        1295.0,
			PvVoltageV:      242.0,
			LoadPowerW:      800.0,
			BatterySoc:      calcSOC,
			BatterySocValid: true,
			BatteryPowerW:   -175.0,
			CollectorSN:     "090101270024170398",
			FirmwareVersion: "1.03",
			PlantName:       "Solo Solar Energy",
			PlantID:         "10151855957824961",
			ID:              "10190715415754208",
		},
		{
			SN:              "07084820022160303",
			Alias:           "Luzira Battery (48V 200Ah)",
			Model:           "LPBF48200-P",
			Type:            "BP",
			TypeName:        "Lithium Battery Pack",
			Status:          "NR",
			RatedPowerKW:    "0",
			Country:         "Uganda",
			TimeZone:        "UTC+03:00",
			PvPowerW:        0.0,
			PvVoltageV:      0.0,
			LoadPowerW:      0.0,
			BatterySoc:      calcSOC,
			BatterySocValid: true,
			BatteryPowerW:   0.0,
			CollectorSN:     "N/A",
			FirmwareVersion: "N/A",
			PlantName:       "Solo Solar Energy",
			PlantID:         "10151855957824961",
			ID:              "10194526907037152",
		},
	}

	return resp
}

func parseFloat(v interface{}) float64 {
	if v == nil {
		return 0.0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	}
	return 0.0
}

func FilterTelemetryByPlant(t TelemetryResponse, plantFilter string) TelemetryResponse {
	if plantFilter == "" || strings.EqualFold(plantFilter, "all") {
		return t
	}

	var filtered []DeviceItem
	totalPV := 0.0
	totalLoad := 0.0
	totalBatPower := 0.0
	totalGridPower := 0.0
	var maxBPSoc float64
	var bpSocList []float64
	var socList []float64

	for _, dev := range t.Devices {
		if strings.EqualFold(dev.PlantName, plantFilter) || 
		   strings.Contains(strings.ToLower(dev.PlantName), strings.ToLower(plantFilter)) ||
		   strings.Contains(strings.ToLower(dev.Alias), strings.ToLower(plantFilter)) {
			filtered = append(filtered, dev)
			totalPV += dev.PvPowerW
			totalLoad += dev.LoadPowerW
			totalBatPower += dev.BatteryPowerW
			totalGridPower += dev.GridPowerW
			if dev.BatterySocValid {
				socList = append(socList, dev.BatterySoc)
				if dev.Type == "BP" {
					bpSocList = append(bpSocList, dev.BatterySoc)
					if dev.BatterySoc > maxBPSoc {
						maxBPSoc = dev.BatterySoc
					}
				} else if dev.Type == "OG" || dev.Type == "HY" {
					bpSocList = append(bpSocList, dev.BatterySoc)
				}
			}
		}
	}

	if len(filtered) == 0 {
		return t
	}

	t.Devices = filtered
	t.PlantInfo.Name = plantFilter
	t.PlantInfo.TotalDevices = len(filtered)
	t.Solar.PowerW = totalPV
	t.Load.PowerW = totalLoad
	t.Grid.PowerW = totalGridPower

	if math.Abs(totalBatPower) > 10.0 {
		t.Battery.PowerW = math.Round(totalBatPower*10) / 10
		if totalBatPower < -10.0 {
			t.Battery.Status = "Charging"
		} else {
			t.Battery.Status = "Discharging"
		}
	} else {
		netPower := (totalPV + totalGridPower) - totalLoad
		if netPower > 10.0 {
			t.Battery.PowerW = -1.0 * math.Round(netPower*10) / 10
			t.Battery.Status = "Charging"
		} else if netPower < -10.0 {
			t.Battery.PowerW = math.Round(math.Abs(netPower)*10) / 10
			t.Battery.Status = "Discharging"
		} else {
			t.Battery.PowerW = 0.0
			t.Battery.Status = "Idle"
		}
	}

	var primaryBPSoc float64
	for _, dev := range filtered {
		if dev.Type == "BP" && dev.BatterySocValid {
			if primaryBPSoc == 0 || strings.Contains(strings.ToLower(dev.Alias), "1") {
				primaryBPSoc = dev.BatterySoc
				if strings.Contains(strings.ToLower(dev.Alias), "1") {
					break
				}
			}
		}
	}

	socValid := false
	t.Battery.SocPercent = 0
	if primaryBPSoc > 0 {
		t.Battery.SocPercent = primaryBPSoc
		socValid = true
	} else if len(bpSocList) > 0 {
		sumSoc := 0.0
		for _, s := range bpSocList {
			sumSoc += s
		}
		t.Battery.SocPercent = math.Round((sumSoc/float64(len(bpSocList)))*10) / 10
		socValid = true
	} else if len(socList) > 0 {
		sumSoc := 0.0
		for _, s := range socList {
			sumSoc += s
		}
		t.Battery.SocPercent = math.Round((sumSoc/float64(len(socList)))*10) / 10
		socValid = true
	}
	t.Battery.SocValid = socValid

	return t
}
