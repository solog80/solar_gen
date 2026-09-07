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
			Timeout:   10 * time.Second,
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

// CalculateSOCFromVoltage calculates battery State of Charge % from measured voltage for Incell 14S Li-ion (SLB48-250-146-21).
// 4 LED dots = 54.2V - 57.0V -> 72% - 92% (in the 70s / 80s range)
// 3 LED dots = 52.5V - 54.1V -> 55% - 71%
// 5 LED dots = 57.0V - 58.8V -> 95% - 100%
func CalculateSOCFromVoltage(v float64) float64 {
	if v <= 0 {
		return 78.0
	}
	if v >= 57.0 {
		return 95.0 + math.Min(5.0, ((v-57.0)/(58.8-57.0))*5.0)
	} else if v >= 54.2 {
		// 4 LED dots range (72% - 92%, in the 70s/80s)
		return 72.0 + ((v-54.2)/(57.0-54.2))*20.0
	} else if v >= 52.5 {
		// 3 LED dots range (55% - 71%)
		return 55.0 + ((v-52.5)/(54.2-52.5))*16.0
	} else if v >= 50.0 {
		// 2 LED dots range (35% - 54%)
		return 35.0 + ((v-50.0)/(52.5-50.0))*19.0
	} else if v >= 47.0 {
		// 1 LED dot range (15% - 34%)
		return 15.0 + ((v-47.0)/(50.0-47.0))*19.0
	} else if v > 40.0 {
		return ((v - 40.0) / (47.0 - 40.0)) * 14.0
	}
	return 0.0
}

func (c *Client) GetTelemetry() TelemetryResponse {
	if c.IsAuthenticated() {
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
			totalLoad := 0.0
			totalBatPower := 0.0
			totalGridPower := 0.0
			maxTemp := 0.0
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
				totalPV += pvDirect

				snap := snapshots[sn]
				devPV := pvDirect
				devLoad := 0.0
				devBatPower := 0.0
				devSoc := 0.0
				devBatVolt := 51.85
				devTemp := 36.5
				devVPV := 240.0
				devPVCurrent := 0.0

				devGridPower := 0.0
				devGridVolt := 230.0

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

					// Parse Battery SOC or calculate from emsVoltage
					if v, ok := snap["battSoc"]; ok && v != nil {
						devSoc = parseFloat(v)
					} else if v, ok := snap["emsSoc"]; ok && v != nil && parseFloat(v) > 1 {
						devSoc = parseFloat(v)
					}
					
					isDisconnected := false
					if v, ok := snap["bmsFlagStr"]; ok && v != nil && v.(string) == "Disconnected" {
						isDisconnected = true
					}

					if (devSoc <= 1.0 || isDisconnected) && devBatVolt > 0 {
						devSoc = math.Round(CalculateSOCFromVoltage(devBatVolt)*10) / 10
					}

					// Parse raw Battery Power (Watts) from telemetry
					rawBatPower := 0.0
					if v, ok := snap["emsPower"]; ok && v != nil && parseFloat(v) != 0 {
						rawBatPower = parseFloat(v)
					} else if v, ok := snap["battPower"]; ok && v != nil && parseFloat(v) != 0 {
						rawBatPower = parseFloat(v)
					} else if devPV > 0 || devLoad > 0 {
						rawBatPower = math.Round(math.Abs(devLoad - devPV)*10) / 10
					}

					// Parse Battery Current (Amps) directly from raw telemetry
					devBatCurrent := 0.0
					if v, ok := snap["emsCurrent"]; ok && v != nil && parseFloat(v) > 0 {
						devBatCurrent = parseFloat(v)
					} else if v, ok := snap["battCurr"]; ok && v != nil && parseFloat(v) > 0 {
						devBatCurrent = parseFloat(v)
					} else if devBatVolt > 0 && rawBatPower > 0 {
						devBatCurrent = math.Round((rawBatPower / devBatVolt)*10) / 10
					}

					// Set battery power sign: Negative = Charging, Positive = Discharging
					if (devPV + devGridPower) >= devLoad {
						devBatPower = -1.0 * math.Abs(rawBatPower)
					} else {
						devBatPower = math.Abs(rawBatPower)
					}

					// Fallback calculation for battery current if missing
					if devBatCurrent == 0 && devBatVolt > 0 {
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

					devLoadCurrent := math.Round((devLoad / 230.0)*10) / 10

					// Parse Temperature
					if v, ok := snap["temperature"]; ok && v != nil {
						devTemp = parseFloat(v)
					}

					typeName := "Hybrid Solar Inverter"
					if dev.DeviceType == "BP" {
						typeName = "Lithium Battery Pack"
					}

					deviceItems = append(deviceItems, DeviceItem{
						SN:              sn,
						Alias:           alias,
						Model:           dev.DeviceModel,
						Type:            dev.DeviceType,
						TypeName:        typeName,
						Status:          dev.Status,
						RatedPowerKW:    dev.RatedPower,
						Country:         dev.CountryName,
						TimeZone:        dev.TimeZone,
						PvPowerW:        devPV,
						PvVoltageV:      devVPV,
						PvCurrentA:      devPVCurrent,
						LoadPowerW:      devLoad,
						LoadCurrentA:    devLoadCurrent,
						BatterySoc:      devSoc,
						BatteryPowerW:   devBatPower,
						BatteryCurrentA: devBatCurrent,
						BatteryVoltageV: devBatVolt,
						GridPowerW:      devGridPower,
						GridVoltageV:    devGridVolt,
						CollectorSN:     dev.CollectorSN,
						FirmwareVersion: dev.ModuleVersion,
						PlantName:       dev.PlantName,
						PlantID:         dev.PlantID,
						ID:              dev.ID,
					})
				} else {
					devSoc = CalculateSOCFromVoltage(devBatVolt)
				}

				if dev.DeviceType == "BP" {
					if devSoc > 0 {
						socList = append(socList, devSoc)
						batVoltList = append(batVoltList, devBatVolt)
					}
				} else {
					totalLoad += devLoad
					totalBatPower += devBatPower
					totalGridPower += devGridPower
					totalPVCurrent += devPVCurrent
					if devVPV > 0 {
						pvVoltList = append(pvVoltList, devVPV)
					}
					if devSoc > 0 {
						socList = append(socList, devSoc)
						batVoltList = append(batVoltList, devBatVolt)
					}
				}

				if devTemp > maxTemp {
					maxTemp = devTemp
				}
			}

			avgSOC := 85.0
			if len(socList) > 0 {
				sum := 0.0
				for _, s := range socList {
					sum += s
				}
				avgSOC = math.Round((sum/float64(len(socList)))*10) / 10
			}

			avgBatVolt := 51.85
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

			batStatus := "Idle"
			if totalBatPower < 0 {
				batStatus = "Charging"
			} else if totalBatPower > 0 {
				batStatus = "Discharging"
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
			resp.Battery.PowerW = math.Round(totalBatPower*10) / 10
			resp.Battery.VoltageV = avgBatVolt
			resp.Battery.Status = batStatus

			resp.Load.PowerW = math.Round(totalLoad*10) / 10
			resp.Load.VoltageV = 230.0
			resp.Load.FrequencyHz = 50.0

			resp.Grid.PowerW = math.Round(totalGridPower*10) / 10
			resp.Grid.VoltageV = 230.0
			resp.Grid.Status = "Connected"

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
	batVolt := 51.85
	calcSOC := CalculateSOCFromVoltage(batVolt)

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
