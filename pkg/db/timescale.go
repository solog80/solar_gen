package db

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"felicity_solar_dashboard/pkg/felicity"
	_ "github.com/lib/pq"
)

type Store struct {
	db          *sql.DB
	client      *felicity.Client
	lastSaved   map[string]time.Time
	lastSavedMu sync.Mutex
}

type SavingsAnalytics struct {
	TotalSolarKWh     float64 `json:"total_solar_kwh"`
	TotalLoadKWh      float64 `json:"total_load_kwh"`
	TotalGridKWh      float64 `json:"total_grid_kwh"`
	SelfConsumedKWh   float64 `json:"self_consumed_solar_kwh"`
	BatteryUsedKWh    float64 `json:"battery_used_kwh"`
	AvoidedImportKWh  float64 `json:"avoided_import_kwh"`
	SolarSavingsUGX   float64 `json:"solar_savings_ugx"`
	BatterySavingsUGX float64 `json:"battery_savings_ugx"`
	PeakSavingsUGX    float64 `json:"peak_savings_ugx"`
	OffPeakSavingsUGX float64 `json:"off_peak_savings_ugx"`
	GridCostUGX       float64 `json:"grid_cost_ugx"`
	TotalSavingsUGX   float64 `json:"total_savings_ugx"`
	TotalSavingsUSD   float64 `json:"total_savings_usd"`
	SolarSelfSuffPct  float64 `json:"solar_self_sufficiency_pct"`
	RecordCount       int64   `json:"total_records_synced"`
	EarliestRecord    string  `json:"earliest_record"`
	LatestRecord      string  `json:"latest_record"`
}

func NewStore(connStr string, client *felicity.Client) (*Store, error) {
	if connStr == "" {
		connStr = "postgres://postgres:becd1f3c85c65c97f57c8a4ee2c96c6c00266a19@100.116.185.70:55439/analytics?sslmode=disable"
	}
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Printf("[TimescaleDB] Warning: Could not ping TimescaleDB at %s: %v", connStr, err)
	} else {
		log.Printf("[TimescaleDB] Successfully connected to TimescaleDB at %s", connStr)
	}

	store := &Store{
		db:        db,
		client:    client,
		lastSaved: make(map[string]time.Time),
	}
	store.InitSchema()
	return store, nil
}

type DashboardUser struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	AllowedPlant string    `json:"allowed_plant"`
	CreatedAt    time.Time `json:"created_at"`
}

func (s *Store) InitSchema() {
	if s.db == nil {
		return
	}
	query := `
	CREATE TABLE IF NOT EXISTS felicity_solar_telemetry (
		time TIMESTAMPTZ NOT NULL,
		device_sn TEXT NOT NULL,
		alias TEXT,
		pv_power_w DOUBLE PRECISION DEFAULT 0.0,
		load_power_w DOUBLE PRECISION DEFAULT 0.0,
		battery_soc DOUBLE PRECISION DEFAULT 0.0,
		battery_power_w DOUBLE PRECISION DEFAULT 0.0,
		grid_power_w DOUBLE PRECISION DEFAULT 0.0,
		PRIMARY KEY (time, device_sn)
	);
	SELECT create_hypertable('felicity_solar_telemetry', 'time', if_not_exists => TRUE);

	CREATE TABLE IF NOT EXISTS dashboard_users (
		id SERIAL PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT DEFAULT 'viewer',
		allowed_plant TEXT DEFAULT '',
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS allowed_plant TEXT DEFAULT '';
	`
	_, _ = s.db.Exec(query)

	// Seed default admin and plant-restricted accounts
	log.Println("[TimescaleDB] Seeding default dashboard users (solo, viewer, saltmedia)...")
	_, _ = s.db.Exec(`
		DELETE FROM dashboard_users WHERE username = 'admin';
		INSERT INTO dashboard_users (username, password_hash, role, allowed_plant) VALUES 
		('solo', 'solo2026', 'admin', ''),
		('viewer', 'viewer123', 'viewer', ''),
		('saltmedia', 'saltmedia2026', 'viewer', 'Salt Media')
		ON CONFLICT (username) DO UPDATE SET allowed_plant = EXCLUDED.allowed_plant;
	`)
}

func (s *Store) AuthenticateDashboardUser(username, password string) (*DashboardUser, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	var u DashboardUser
	err := s.db.QueryRow("SELECT id, username, password_hash, role, COALESCE(allowed_plant, ''), created_at FROM dashboard_users WHERE username = $1", username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.AllowedPlant, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid username or password")
	}

	if u.PasswordHash != password { // Simple plain hash for local setup
		return nil, fmt.Errorf("invalid username or password")
	}

	return &u, nil
}

func (s *Store) CreateDashboardUser(username, password, role, allowedPlant string) (*DashboardUser, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	if role == "" {
		role = "viewer"
	}
	var u DashboardUser
	err := s.db.QueryRow(`
		INSERT INTO dashboard_users (username, password_hash, role, allowed_plant)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, role, COALESCE(allowed_plant, ''), created_at
	`, username, password, role, allowedPlant).Scan(&u.ID, &u.Username, &u.Role, &u.AllowedPlant, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("user creation failed: %v", err)
	}
	return &u, nil
}

func (s *Store) ListDashboardUsers() ([]DashboardUser, error) {
	var users []DashboardUser
	if s.db == nil {
		return users, fmt.Errorf("database not connected")
	}
	rows, err := s.db.Query("SELECT id, username, role, COALESCE(allowed_plant, ''), created_at FROM dashboard_users ORDER BY id ASC")
	if err != nil {
		return users, err
	}
	defer rows.Close()

	for rows.Next() {
		var u DashboardUser
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.AllowedPlant, &u.CreatedAt); err == nil {
			users = append(users, u)
		}
	}
	return users, nil
}

func (s *Store) DeleteDashboardUser(id int) error {
	if s.db == nil {
		return fmt.Errorf("database not connected")
	}
	_, err := s.db.Exec("DELETE FROM dashboard_users WHERE id = $1", id)
	return err
}

func (s *Store) SaveTelemetry(t felicity.TelemetryResponse) error {
	if s.db == nil {
		return nil
	}

	s.lastSavedMu.Lock()
	now := time.Now()
	shouldSave := false
	for _, dev := range t.Devices {
		if dev.SN != "" && now.Sub(s.lastSaved[dev.SN]) >= 5*time.Minute {
			shouldSave = true
			break
		}
	}
	if !shouldSave {
		s.lastSavedMu.Unlock()
		return nil
	}
	s.lastSavedMu.Unlock()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO felicity_solar_telemetry (time, device_sn, alias, pv_power_w, load_power_w, battery_soc, battery_power_w, grid_power_w)
		VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (time, device_sn) DO NOTHING
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	s.lastSavedMu.Lock()
	for _, dev := range t.Devices {
		if dev.SN != "" && now.Sub(s.lastSaved[dev.SN]) >= 5*time.Minute {
			_, _ = stmt.Exec(dev.SN, dev.Alias, dev.PvPowerW, dev.LoadPowerW, dev.BatterySoc, dev.BatteryPowerW, dev.GridPowerW)
			s.lastSaved[dev.SN] = now
		}
	}
	s.lastSavedMu.Unlock()

	return tx.Commit()
}

func (s *Store) BackfillHistory(days int) (int, error) {
	if s.db == nil || s.client == nil {
		return 0, fmt.Errorf("database disconnected or client unavailable")
	}

	if !s.client.IsAuthenticated() {
		if !s.client.Login("", "") {
			return 0, fmt.Errorf("client login failed for backfill")
		}
	}

	devices := s.client.FetchDevices()
	if len(devices) == 0 {
		return 0, fmt.Errorf("no devices found")
	}

	log.Printf("[TimescaleDB] Starting %d-day historical backfill for %d device(s)...", days, len(devices))
	totalInserted := 0
	now := time.Now()

	for _, dev := range devices {
		if dev.DeviceSN == "" {
			continue
		}
		sn := dev.DeviceSN
		alias := dev.Alias
		if alias == "" {
			alias = sn
		}

		for d := 0; d < days; d++ {
			dateStr := now.AddDate(0, 0, -d).Format("2006-01-02")

			// Mubende devices were installed on Sep 27, 2026 - skip backfilling prior dates
			if strings.HasPrefix(alias, "Mubende") || sn == "010310004825430201" || sn == "050612004825250620" || sn == "074604850026170116" || sn == "074604850026170118" {
				if dateStr < "2026-09-27" {
					continue
				}
			}

			snap := s.client.FetchDeviceSnapshotForDate(sn, dateStr)
			if snap == nil {
				continue
			}

			pv := 0.0
			load := 0.0
			batVolt := 53.7
			soc := 60.0
			grid := 0.0

			if v, ok := snap["pvTotalPower"]; ok && v != nil {
				pv = felicityParseFloat(v)
			} else if v, ok := snap["pvPower"]; ok && v != nil {
				pv = felicityParseFloat(v)
			}

			if v, ok := snap["acTotalOutActPower"]; ok && v != nil {
				load = felicityParseFloat(v)
			} else if v, ok := snap["acROutPower"]; ok && v != nil {
				load = felicityParseFloat(v)
			}

			if v, ok := snap["battSoc"]; ok && v != nil && felicityParseFloat(v) > 1 {
				soc = felicityParseFloat(v)
			} else if v, ok := snap["emsSoc"]; ok && v != nil && felicityParseFloat(v) > 1 {
				soc = felicityParseFloat(v)
			} else if v, ok := snap["emsSocAvg"]; ok && v != nil && felicityParseFloat(v) > 1 {
				soc = felicityParseFloat(v)
			} else if v, ok := snap["emsVoltage"]; ok && v != nil {
				batVolt = felicityParseFloat(v)
				if est, ok := felicity.EstimateBankSOC(dev.DeviceModel, dev.DeviceSN, batVolt); ok {
					soc = est
				}
			} else if v, ok := snap["battery_voltage_v"]; ok && v != nil {
				batVolt = felicityParseFloat(v)
				if est, ok := felicity.EstimateBankSOC(dev.DeviceModel, dev.DeviceSN, batVolt); ok {
					soc = est
				}
			}

			// Generate 24 hourly data points for this backfilled day
			dayStart, _ := time.Parse("2006-01-02", dateStr)
			for h := 0; h < 24; h++ {
				tPoint := dayStart.Add(time.Duration(h) * time.Hour)

				pvH := 0.0
				if h >= 6 && h <= 18 && pv > 0 {
					pvH = math.Round((pv*math.Sin(math.Pi*float64(h-6)/12.0))*10) / 10
				}
				loadH := math.Round((load*(0.8+0.4*math.Sin(float64(h)/3.0)))*10) / 10
				socH := math.Max(15.0, math.Min(100.0, math.Round((soc+3.0*math.Sin(float64(h-7)/4.0))*10)/10))
				batPowerH := math.Round((loadH-pvH)*10) / 10

				_, err := s.db.Exec(`
					INSERT INTO felicity_solar_telemetry (time, device_sn, alias, pv_power_w, load_power_w, battery_soc, battery_power_w, grid_power_w)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (time, device_sn) DO UPDATE SET 
						battery_power_w = CASE WHEN felicity_solar_telemetry.battery_power_w = 0 THEN EXCLUDED.battery_power_w ELSE felicity_solar_telemetry.battery_power_w END
				`, tPoint, sn, alias, pvH, loadH, socH, batPowerH, grid)
				if err == nil {
					totalInserted++
				}
			}
		}
	}

	log.Printf("[TimescaleDB] Backfill completed. Total %d records saved.", totalInserted)
	return totalInserted, nil
}

// telemetryWhere is the shared analytics filter. Placeholders:
// $1 = device SN (optional), $2 = start date, $3 = end date, $4 = plant (optional).
const telemetryWhere = `($4 != '' OR $1 = '' OR device_sn = $1)
				  AND ($2 = '' OR time >= $2::timestamp)
				  AND ($3 = '' OR time <= ($3::timestamp + INTERVAL '1 day'))
				  AND ($4 = '' OR (LOWER($4) LIKE '%salt%' AND (alias ILIKE '%mubende%' OR alias ILIKE '%salt%')) OR (LOWER($4) LIKE '%solo%' AND (alias ILIKE '%mutungo%' OR alias ILIKE '%luzira%' OR alias ILIKE '%solo%')) OR (alias ILIKE '%' || $4 || '%'))`

// Energy accounting per plant interval, shared by the analytics + breakdown queries.
// Devices sharing a save timestamp are summed first (per_time); each interval is then
// valued at its Time-of-Use tariff. Savings = avoided grid import = load minus grid
// import (signed: grid-charging intervals count negative), split into the direct-solar
// portion and the battery residual.
const intervalEnergyCTE = `
		per_time AS (
			SELECT
				time,
				SUM(pv_power_w)   AS pv_w,
				SUM(load_power_w) AS load_w,
				SUM(grid_power_w) AS grid_w
			FROM felicity_solar_telemetry
			WHERE ` + telemetryWhere + `
			GROUP BY time
		),
		enriched AS (
			SELECT
				time,
				GREATEST(0.0, LEAST(0.25, EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) / 3600.0)) AS dt_h,
				GREATEST(0.0, pv_w)   AS pv,
				GREATEST(0.0, load_w) AS load,
				GREATEST(0.0, grid_w) AS grid,
				CASE
					WHEN EXTRACT(HOUR FROM (time AT TIME ZONE 'UTC' AT TIME ZONE 'EAT')) >= 18 THEN 650.50
					WHEN EXTRACT(HOUR FROM (time AT TIME ZONE 'UTC' AT TIME ZONE 'EAT')) >= 6  THEN 546.00
					ELSE 414.00
				END AS tou_rate,
				(EXTRACT(HOUR FROM (time AT TIME ZONE 'UTC' AT TIME ZONE 'EAT')) >= 18) AS is_peak
			FROM per_time
		),
		calc AS (
			SELECT
				time, tou_rate, is_peak,
				(pv   * dt_h / 1000.0) AS solar_kwh,
				(load * dt_h / 1000.0) AS load_kwh,
				(grid * dt_h / 1000.0) AS grid_kwh,
				((load - grid) * dt_h / 1000.0) AS nongrid_kwh,
				(LEAST(pv, load) * dt_h / 1000.0) AS solar_to_load_kwh
			FROM enriched
		),
		derived AS (
			SELECT
				time, tou_rate, is_peak,
				solar_kwh, load_kwh, grid_kwh, nongrid_kwh, solar_to_load_kwh,
				nongrid_kwh - solar_to_load_kwh AS battery_kwh
			FROM calc
		)`

func (s *Store) GetAnalytics(deviceSN string, plant string, startDate string, endDate string) (SavingsAnalytics, error) {
	var a SavingsAnalytics
	if s.db == nil {
		return a, fmt.Errorf("database not connected")
	}

	query := `
		WITH ` + intervalEnergyCTE + `
		SELECT
			COALESCE(SUM(solar_kwh), 0.0),
			COALESCE(SUM(load_kwh), 0.0),
			COALESCE(SUM(grid_kwh), 0.0),
			COALESCE(SUM(solar_to_load_kwh), 0.0),
			COALESCE(SUM(battery_kwh), 0.0),
			COALESCE(SUM(nongrid_kwh), 0.0),
			COALESCE(SUM(solar_to_load_kwh * tou_rate), 0.0),
			COALESCE(SUM(battery_kwh * tou_rate), 0.0),
			COALESCE(SUM(CASE WHEN is_peak THEN nongrid_kwh * tou_rate ELSE 0.0 END), 0.0),
			COALESCE(SUM(CASE WHEN NOT is_peak THEN nongrid_kwh * tou_rate ELSE 0.0 END), 0.0),
			COALESCE(SUM(grid_kwh * tou_rate), 0.0),
			(SELECT COUNT(*) FROM felicity_solar_telemetry WHERE ` + telemetryWhere + `),
			COALESCE(MIN(time)::text, ''),
			COALESCE(MAX(time)::text, '')
		FROM derived
	`

	row := s.db.QueryRow(query, deviceSN, startDate, endDate, plant)
	err := row.Scan(
		&a.TotalSolarKWh, &a.TotalLoadKWh, &a.TotalGridKWh,
		&a.SelfConsumedKWh, &a.BatteryUsedKWh, &a.AvoidedImportKWh,
		&a.SolarSavingsUGX, &a.BatterySavingsUGX,
		&a.PeakSavingsUGX, &a.OffPeakSavingsUGX, &a.GridCostUGX,
		&a.RecordCount, &a.EarliestRecord, &a.LatestRecord,
	)
	if err != nil {
		return a, err
	}

	const UGXToUSD = 3700.0

	a.TotalSolarKWh = math.Round(a.TotalSolarKWh*100) / 100
	a.TotalLoadKWh = math.Round(a.TotalLoadKWh*100) / 100
	a.TotalGridKWh = math.Round(a.TotalGridKWh*100) / 100
	a.SelfConsumedKWh = math.Round(a.SelfConsumedKWh*100) / 100
	a.BatteryUsedKWh = math.Round(a.BatteryUsedKWh*100) / 100
	a.AvoidedImportKWh = math.Round(a.AvoidedImportKWh*100) / 100
	a.SolarSavingsUGX = math.Round(a.SolarSavingsUGX)
	a.BatterySavingsUGX = math.Round(a.BatterySavingsUGX)
	a.PeakSavingsUGX = math.Round(a.PeakSavingsUGX)
	a.OffPeakSavingsUGX = math.Round(a.OffPeakSavingsUGX)
	a.GridCostUGX = math.Round(a.GridCostUGX)

	// Headline = avoided grid import (direct solar + battery discharge) valued at
	// the hour it was consumed. Grid cost is reported separately as the actual bill.
	a.TotalSavingsUGX = math.Round(a.SolarSavingsUGX + a.BatterySavingsUGX)
	a.TotalSavingsUSD = math.Round((a.TotalSavingsUGX/UGXToUSD)*100) / 100

	if a.TotalLoadKWh > 0 {
		a.SolarSelfSuffPct = math.Max(0.0, math.Min(100.0, math.Round((a.SelfConsumedKWh/a.TotalLoadKWh)*1000)/10))
	} else {
		a.SolarSelfSuffPct = 0.0
	}

	return a, nil
}

func (s *Store) GetPeriodBreakdown(deviceSN string, plant string, period string, startDate string, endDate string) (felicity.PeriodBreakdownResponse, error) {
	resp := felicity.PeriodBreakdownResponse{
		DeviceSN: deviceSN,
		Period:   period,
		Items:    []felicity.PeriodItem{},
	}
	if s.db == nil {
		return resp, fmt.Errorf("database not connected")
	}

	var formatStr string
	var bucketInterval string
	var limitVal int

	switch period {
	case "weekly":
		formatStr = "YYYY \"W\"IW"
		bucketInterval = "1 week"
		limitVal = 52
	case "monthly":
		formatStr = "YYYY-MM"
		bucketInterval = "1 month"
		limitVal = 36
	default: // daily
		period = "daily"
		resp.Period = "daily"
		formatStr = "YYYY-MM-DD"
		bucketInterval = "1 day"
		limitVal = 100
	}

	query := `
		WITH ` + intervalEnergyCTE + `,
		bucketed AS (
			SELECT *, to_char(time_bucket('` + bucketInterval + `', time), '` + formatStr + `') AS period_label
			FROM derived
		)
		SELECT
			period_label,
			COALESCE(SUM(solar_kwh), 0.0),
			COALESCE(SUM(load_kwh), 0.0),
			COALESCE(SUM(grid_kwh), 0.0),
			COALESCE(SUM(solar_to_load_kwh * tou_rate) + SUM(battery_kwh * tou_rate), 0.0) AS savings_ugx,
			COALESCE(SUM(solar_to_load_kwh), 0.0),
			COALESCE(SUM(battery_kwh), 0.0),
			COALESCE(SUM(grid_kwh * tou_rate), 0.0)
		FROM bucketed
		GROUP BY period_label
		ORDER BY period_label DESC
		LIMIT ` + strconv.Itoa(limitVal)

	rows, err := s.db.Query(query, deviceSN, startDate, endDate, plant)
	if err != nil {
		return resp, err
	}
	defer rows.Close()

	const UGXToUSD = 3700.0

	for rows.Next() {
		var item felicity.PeriodItem
		if err := rows.Scan(&item.PeriodLabel, &item.SolarKWh, &item.LoadKWh, &item.GridKWh, &item.SavingsUGX, &item.SelfConsumedKWh, &item.BatteryUsedKWh, &item.GridCostUGX); err == nil {
			item.SolarKWh = math.Round(item.SolarKWh*100) / 100
			item.LoadKWh = math.Round(item.LoadKWh*100) / 100
			item.GridKWh = math.Round(item.GridKWh*100) / 100
			item.SelfConsumedKWh = math.Round(item.SelfConsumedKWh*100) / 100
			item.BatteryUsedKWh = math.Round(item.BatteryUsedKWh*100) / 100
			item.GridCostUGX = math.Round(item.GridCostUGX)
			item.SavingsUGX = math.Round(item.SavingsUGX)
			item.SavingsUSD = math.Round((item.SavingsUGX/UGXToUSD)*100) / 100
			resp.Items = append(resp.Items, item)
		}
	}

	return resp, nil
}

func (s *Store) Get24HourHistory(deviceSN string, plant string) ([]felicity.HistoryPoint, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		WITH time_series AS (
			SELECT generate_series(
				date_trunc('hour', NOW() - INTERVAL '23 hours'),
				date_trunc('hour', NOW()),
				INTERVAL '1 hour'
			) AS series_time
		),
		device_hourly AS (
			SELECT 
				date_trunc('hour', t.time) AS hourly_time,
				t.device_sn,
				AVG(t.pv_power_w) AS dev_pv_power,
				AVG(t.load_power_w) AS dev_load_power,
				MAX(t.battery_soc) AS dev_battery_soc,
				AVG(t.battery_power_w) AS dev_battery_power,
				MAX(t.grid_power_w) AS dev_grid_power
			FROM felicity_solar_telemetry t
			WHERE ($1 = '' OR t.device_sn = $1)
			  AND ($2 = '' OR (LOWER($2) LIKE '%salt%' AND (t.alias ILIKE '%mubende%' OR t.alias ILIKE '%salt%')) OR (LOWER($2) LIKE '%solo%' AND (t.alias ILIKE '%mutungo%' OR t.alias ILIKE '%luzira%' OR t.alias ILIKE '%solo%')) OR (t.alias ILIKE '%' || $2 || '%'))
			GROUP BY date_trunc('hour', t.time), t.device_sn
		)
		SELECT 
			to_char(ts.series_time + INTERVAL '3 hours', 'HH24:00') AS hour_label,
			COALESCE(SUM(dh.dev_pv_power), 0.0) AS pv_power,
			COALESCE(MAX(dh.dev_load_power), 0.0) AS load_power,
			COALESCE(MAX(dh.dev_battery_soc), 0.0) AS battery_soc,
			COALESCE(SUM(dh.dev_battery_power), 0.0) AS battery_power,
			COALESCE(MAX(dh.dev_grid_power), 0.0) AS grid_power
		FROM time_series ts
		LEFT JOIN device_hourly dh ON dh.hourly_time = ts.series_time
		GROUP BY ts.series_time
		ORDER BY ts.series_time ASC
	`

	rows, err := s.db.Query(query, deviceSN, plant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []felicity.HistoryPoint
	for rows.Next() {
		var h felicity.HistoryPoint
		if err := rows.Scan(&h.Time, &h.PvPower, &h.LoadPower, &h.BatterySoc, &h.BatteryPowerW, &h.GridPowerW); err == nil {
			h.PvPower = math.Round(h.PvPower*10) / 10
			h.LoadPower = math.Round(h.LoadPower*10) / 10
			h.BatterySoc = math.Round(h.BatterySoc*10) / 10
			h.BatteryPowerW = math.Round(h.BatteryPowerW*10) / 10
			h.GridPowerW = math.Round(h.GridPowerW*10) / 10
			history = append(history, h)
		}
	}

	return history, nil
}

func felicityParseFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int64:
		return float64(val)
	case int:
		return float64(val)
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	}
	return 0.0
}
