package felicity

// Config represents saved user credentials and token.
type Config struct {
	Email       string  `json:"email"`
	Password    string  `json:"password"`
	BearerToken string  `json:"bearer_token"`
	TokenExpiry float64 `json:"token_expiry"`
}

// LoginRequest payload sent to Shine Felicity API.
type LoginRequest struct {
	UserName string `json:"userName"`
	Password string `json:"password"`
}

// LoginResponse format from Shine Felicity API.
type LoginResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Token   string      `json:"token,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// DeviceRawItem represents raw device item from list_device_all_type.
type DeviceRawItem struct {
	ID            string      `json:"id"`
	DeviceSN      string      `json:"deviceSn"`
	DeviceType    string      `json:"deviceType"`
	DeviceModel   string      `json:"deviceModel"`
	Alias         string      `json:"alias"`
	PlantName     string      `json:"plantName"`
	PlantID       string      `json:"plantId"`
	CountryName   string      `json:"countryName"`
	TimeZone      string      `json:"timeZone"`
	CollectorSN   string      `json:"collectorSn"`
	RatedPower    string      `json:"ratedPower"`
	Status        string      `json:"status"`
	ModuleVersion string      `json:"moduleVersion"`
	PvTotalPower  interface{} `json:"pvTotalPower"`
}

// DeviceListResponse from list_device_all_type.
type DeviceListResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		DataList []DeviceRawItem `json:"dataList"`
	} `json:"data"`
}

// DeviceSnapshotResponse from get_device_snapshot.
type DeviceSnapshotResponse struct {
	Code    int                    `json:"code"`
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data"`
}

// DeviceItem processed for frontend telemetry.
type DeviceItem struct {
	SN              string  `json:"sn"`
	Alias           string  `json:"alias"`
	Model           string  `json:"model"`
	Type            string  `json:"type"`
	TypeName        string  `json:"type_name"`
	Status          string  `json:"status"`
	RatedPowerKW    string  `json:"rated_power_kw"`
	Country         string  `json:"country"`
	TimeZone        string  `json:"timezone"`
	PvPowerW        float64 `json:"pv_power_w"`
	PvVoltageV      float64 `json:"pv_voltage_v"`
	PvCurrentA      float64 `json:"pv_current_a"`
	LoadPowerW      float64 `json:"load_power_w"`
	LoadCurrentA    float64 `json:"load_current_a"`
	BatterySoc      float64 `json:"battery_soc"`
	BatteryPowerW   float64 `json:"battery_power_w"`
	BatteryCurrentA float64 `json:"battery_current_a"`
	GridPowerW      float64 `json:"grid_power_w"`
	GridVoltageV    float64 `json:"grid_voltage_v"`
	CollectorSN     string  `json:"collector_sn"`
	FirmwareVersion string  `json:"firmware_version"`
	PlantName       string  `json:"plant_name"`
	PlantID         string  `json:"plant_id"`
	ID              string  `json:"id"`
}

// TelemetryResponse returned by /api/status.
type TelemetryResponse struct {
	Timestamp  string `json:"timestamp"`
	IsLive     bool   `json:"is_live"`
	Configured bool   `json:"configured"`
	PlantInfo  struct {
		Name         string `json:"name"`
		TotalDevices int    `json:"total_devices"`
		Status       string `json:"status"`
	} `json:"plant_info"`
	Solar struct {
		PowerW   float64 `json:"power_w"`
		VoltageV float64 `json:"voltage_v"`
		CurrentA float64 `json:"current_a"`
	} `json:"solar"`
	Battery struct {
		SocPercent float64 `json:"soc_percent"`
		PowerW     float64 `json:"power_w"`
		VoltageV   float64 `json:"voltage_v"`
		Status     string  `json:"status"`
	} `json:"battery"`
	Load struct {
		PowerW      float64 `json:"power_w"`
		VoltageV    float64 `json:"voltage_v"`
		FrequencyHz float64 `json:"frequency_hz"`
	} `json:"load"`
	Grid struct {
		PowerW   float64 `json:"power_w"`
		VoltageV float64 `json:"voltage_v"`
		Status   string  `json:"status"`
	} `json:"grid"`
	System struct {
		InverterTempC float64 `json:"inverter_temp_c"`
		HealthStatus  string  `json:"health_status"`
	} `json:"system"`
	Devices []DeviceItem `json:"devices"`
}

// HistoryPoint represents 24-hour power trend point for overall plant or single device.
type HistoryPoint struct {
	Time          string  `json:"time"`
	PvPower       float64 `json:"pv_power"`
	LoadPower     float64 `json:"load_power"`
	BatterySoc    float64 `json:"battery_soc"`
	BatteryPowerW float64 `json:"battery_power_w"`
	GridPowerW    float64 `json:"grid_power_w"`
}

type PeriodItem struct {
	PeriodLabel string  `json:"period_label"`
	SolarKWh    float64 `json:"solar_kwh"`
	LoadKWh     float64 `json:"load_kwh"`
	GridKWh     float64 `json:"grid_kwh"`
	SavingsUGX  float64 `json:"savings_ugx"`
	SavingsUSD  float64 `json:"savings_usd"`
}

type PeriodBreakdownResponse struct {
	DeviceSN string       `json:"device_sn"`
	Period   string       `json:"period"`
	Items    []PeriodItem `json:"items"`
}
