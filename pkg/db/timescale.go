package db

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"time"

	_ "github.com/lib/pq"
	"felicity_solar_dashboard/pkg/felicity"
)

type Store struct {
	db     *sql.DB
	client *felicity.Client
}

type SavingsAnalytics struct {
	TotalSolarKWh    float64 `json:"total_solar_kwh"`
	TotalLoadKWh     float64 `json:"total_load_kwh"`
	TotalGridKWh     float64 `json:"total_grid_kwh"`
	TotalSavingsUGX  float64 `json:"total_savings_ugx"`
	TotalSavingsUSD  float64 `json:"total_savings_usd"`
	SolarSelfSuffPct float64 `json:"solar_self_sufficiency_pct"`
	RecordCount      int64   `json:"total_records_synced"`
	EarliestRecord   string  `json:"earliest_record"`
	LatestRecord     string  `json:"latest_record"`
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

	store := &Store{db: db, client: client}
	store.InitSchema()
	return store, nil
}

type DashboardUser struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
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
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	`
	_, _ = s.db.Exec(query)

	// Seed default admin accounts if no users exist
	var count int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM dashboard_users").Scan(&count)
	if count == 0 {
		log.Println("[TimescaleDB] Seeding default dashboard users (admin, solo, viewer)...")
		_, _ = s.db.Exec(`
			INSERT INTO dashboard_users (username, password_hash, role) VALUES 
			('admin', 'admin123', 'admin'),
			('solo', 'solo2026', 'admin'),
			('viewer', 'viewer123', 'viewer')
			ON CONFLICT (username) DO NOTHING;
		`)
	}
}

func (s *Store) AuthenticateDashboardUser(username, password string) (*DashboardUser, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	var u DashboardUser
	err := s.db.QueryRow("SELECT id, username, password_hash, role, created_at FROM dashboard_users WHERE username = $1", username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid username or password")
	}

	if u.PasswordHash != password { // Simple plain hash for local setup
		return nil, fmt.Errorf("invalid username or password")
	}

	return &u, nil
}

func (s *Store) CreateDashboardUser(username, password, role string) (*DashboardUser, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	if role == "" {
		role = "viewer"
	}
	var u DashboardUser
	err := s.db.QueryRow(`
		INSERT INTO dashboard_users (username, password_hash, role)
		VALUES ($1, $2, $3)
		RETURNING id, username, role, created_at
	`, username, password, role).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
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
	rows, err := s.db.Query("SELECT id, username, role, created_at FROM dashboard_users ORDER BY id ASC")
	if err != nil {
		return users, err
	}
	defer rows.Close()

	for rows.Next() {
		var u DashboardUser
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err == nil {
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

	for _, dev := range t.Devices {
		_, _ = stmt.Exec(dev.SN, dev.Alias, dev.PvPowerW, dev.LoadPowerW, dev.BatterySoc, dev.BatteryPowerW, dev.GridPowerW)
	}

	return tx.Commit()
}

func (s *Store) BackfillHistory(days int) (int, error) {
	if s.db == nil || s.client == nil || !s.client.IsAuthenticated() {
		return 0, fmt.Errorf("client not authenticated or database disconnected")
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
			}
			if v, ok := snap["acTotalOutActPower"]; ok && v != nil {
				load = felicityParseFloat(v)
			}
			if v, ok := snap["emsVoltage"]; ok && v != nil {
				batVolt = felicityParseFloat(v)
				soc = felicity.CalculateSOCFromVoltage(batVolt)
			}

			// Generate 24 hourly data points for this backfilled day
			dayStart, _ := time.Parse("2006-01-02", dateStr)
			for h := 0; h < 24; h++ {
				tPoint := dayStart.Add(time.Duration(h) * time.Hour)
				
				pvH := 0.0
				if h >= 6 && h <= 18 && pv > 0 {
					pvH = math.Round((pv*math.Sin(math.Pi*float64(h-6)/12.0))*10) / 10
				}
				loadH := math.Round((load* (0.8 + 0.4*math.Sin(float64(h)/3.0)))*10) / 10
				socH := math.Max(15.0, math.Min(100.0, math.Round((soc + 3.0*math.Sin(float64(h-7)/4.0))*10)/10))

				_, err := s.db.Exec(`
					INSERT INTO felicity_solar_telemetry (time, device_sn, alias, pv_power_w, load_power_w, battery_soc, battery_power_w, grid_power_w)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (time, device_sn) DO NOTHING
				`, tPoint, sn, alias, pvH, loadH, socH, 0.0, grid)
				if err == nil {
					totalInserted++
				}
			}
		}
	}

	log.Printf("[TimescaleDB] Backfill completed. Total %d records saved.", totalInserted)
	return totalInserted, nil
}

func (s *Store) GetAnalytics(deviceSN string, startDate string, endDate string) (SavingsAnalytics, error) {
	var a SavingsAnalytics
	if s.db == nil {
		return a, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			COALESCE(SUM(pv_power_w * (5.0/60.0) / 1000.0), 0.0) as solar_kwh,
			COALESCE(SUM(load_power_w * (5.0/60.0) / 1000.0), 0.0) as load_kwh,
			COALESCE(SUM(grid_power_w * (5.0/60.0) / 1000.0), 0.0) as grid_kwh,
			COUNT(*) as cnt,
			COALESCE(MIN(time)::text, '') as earliest,
			COALESCE(MAX(time)::text, '') as latest
		FROM felicity_solar_telemetry
		WHERE ($1 = '' OR device_sn = $1)
		  AND ($2 = '' OR time >= $2::timestamp)
		  AND ($3 = '' OR time <= ($3::timestamp + INTERVAL '1 day'))
	`

	row := s.db.QueryRow(query, deviceSN, startDate, endDate)
	err := row.Scan(&a.TotalSolarKWh, &a.TotalLoadKWh, &a.TotalGridKWh, &a.RecordCount, &a.EarliestRecord, &a.LatestRecord)
	if err != nil {
		return a, err
	}

	// Umeme Uganda average tariff rate: ~890 UGX / kWh ($0.24 USD)
	const TariffUGXPerKWh = 890.0
	const UGXToUSD = 3700.0

	a.TotalSavingsUGX = math.Round(a.TotalSolarKWh * TariffUGXPerKWh)
	a.TotalSavingsUSD = math.Round((a.TotalSavingsUGX / UGXToUSD) * 100) / 100

	if a.TotalLoadKWh > 0 {
		nonGridLoadKWh := math.Max(0.0, a.TotalLoadKWh-a.TotalGridKWh)
		solarContribKWh := math.Min(a.TotalSolarKWh, nonGridLoadKWh)
		a.SolarSelfSuffPct = math.Max(0.0, math.Min(100.0, math.Round((solarContribKWh/a.TotalLoadKWh)*1000)/10))
	} else {
		a.SolarSelfSuffPct = 0.0
	}

	return a, nil
}

func (s *Store) GetPeriodBreakdown(deviceSN string, period string, startDate string, endDate string) (felicity.PeriodBreakdownResponse, error) {
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

	query := fmt.Sprintf(`
		SELECT 
			to_char(time_bucket('%s', time), '%s') AS period_label,
			COALESCE(SUM(pv_power_w * (5.0/60.0) / 1000.0), 0.0) as solar_kwh,
			COALESCE(SUM(load_power_w * (5.0/60.0) / 1000.0), 0.0) as load_kwh,
			COALESCE(SUM(grid_power_w * (5.0/60.0) / 1000.0), 0.0) as grid_kwh
		FROM felicity_solar_telemetry
		WHERE ($1 = '' OR device_sn = $1)
		  AND ($2 = '' OR time >= $2::timestamp)
		  AND ($3 = '' OR time <= ($3::timestamp + INTERVAL '1 day'))
		GROUP BY period_label
		ORDER BY period_label DESC
		LIMIT %d
	`, bucketInterval, formatStr, limitVal)

	rows, err := s.db.Query(query, deviceSN, startDate, endDate)
	if err != nil {
		return resp, err
	}
	defer rows.Close()

	const TariffUGXPerKWh = 890.0
	const UGXToUSD = 3700.0

	for rows.Next() {
		var item felicity.PeriodItem
		if err := rows.Scan(&item.PeriodLabel, &item.SolarKWh, &item.LoadKWh, &item.GridKWh); err == nil {
			item.SolarKWh = math.Round(item.SolarKWh*100) / 100
			item.LoadKWh = math.Round(item.LoadKWh*100) / 100
			item.GridKWh = math.Round(item.GridKWh*100) / 100
			item.SavingsUGX = math.Round(item.SolarKWh * TariffUGXPerKWh)
			item.SavingsUSD = math.Round((item.SavingsUGX / UGXToUSD) * 100) / 100
			resp.Items = append(resp.Items, item)
		}
	}

	return resp, nil
}

func (s *Store) Get24HourHistory(deviceSN string) ([]felicity.HistoryPoint, error) {
	if s.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT 
			to_char(tb + INTERVAL '3 hours', 'HH24:00') AS hour_label,
			COALESCE(AVG(pv_power_w), 0.0) as pv_power,
			COALESCE(AVG(load_power_w), 0.0) as load_power,
			COALESCE(AVG(battery_soc), 0.0) as battery_soc,
			COALESCE(AVG(battery_power_w), 0.0) as battery_power,
			COALESCE(AVG(grid_power_w), 0.0) as grid_power
		FROM (
			SELECT time_bucket('1 hour', time) AS tb,
			       pv_power_w, load_power_w, battery_soc, battery_power_w, grid_power_w
			FROM felicity_solar_telemetry
			WHERE ($1 = '' OR device_sn = $1)
			  AND time >= NOW() - INTERVAL '24 hours'
			  AND time <= NOW()
		) sub
		GROUP BY tb
		ORDER BY tb ASC
		LIMIT 25
	`

	rows, err := s.db.Query(query, deviceSN)
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
