package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"felicity_solar_dashboard/pkg/db"
	"felicity_solar_dashboard/pkg/felicity"
)

const Port = 8085

var client *felicity.Client
var dbStore *db.Store

func main() {
	execDir, _ := os.Getwd()
	pkgDir := filepath.Join(execDir, "pkg", "felicity")

	client = felicity.NewClient(pkgDir)

	var err error
	dbStore, err = db.NewStore("postgres://postgres:becd1f3c85c65c97f57c8a4ee2c96c6c00266a19@100.116.185.70:55439/analytics?sslmode=disable", client)
	if err != nil {
		log.Printf("[TimescaleDB] Connect error: %v", err)
	} else {
		// Run initial 30-day historical backfill asynchronously
		go func() {
			time.Sleep(3 * time.Second)
			if client.IsAuthenticated() {
				_, _ = dbStore.BackfillHistory(30)
			}
		}()
	}

	mux := http.NewServeMux()

	// API Handlers
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/config", handleConfig)
	mux.HandleFunc("/api/history", handleHistory)
	mux.HandleFunc("/api/device/history", handleDeviceHistory)
	mux.HandleFunc("/api/analytics", handleAnalytics)
	mux.HandleFunc("/api/breakdown", handleBreakdown)
	mux.HandleFunc("/api/backfill", handleBackfill)
	mux.HandleFunc("/api/auth/login", handleAuthLogin)
	mux.HandleFunc("/api/auth/users", handleAuthUsers)

	// Static Files Handler (React build dist or fallback frontend)
	distDir := filepath.Join(execDir, "frontend", "dist")
	if _, err := os.Stat(distDir); os.IsNotExist(err) {
		distDir = filepath.Join(execDir, "frontend")
	}
	fs := http.FileServer(http.Dir(distDir))
	mux.Handle("/", fs)

	handler := corsMiddleware(mux)

	log.Printf("\n=======================================================")
	log.Printf(" 🚀 Go Felicity Solar Dashboard Server Running!")
	log.Printf(" Access UI in Browser: http://localhost:%d", Port)
	log.Printf(" TimescaleDB Backend Connected: 100.116.185.70:55439")
	log.Printf("=======================================================\n")

	if err := http.ListenAndServe(fmt.Sprintf(":%d", Port), handler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	telemetry := client.GetTelemetry()

	if dbStore != nil && telemetry.IsLive {
		_ = dbStore.SaveTelemetry(telemetry)
	}

	_ = json.NewEncoder(w).Encode(telemetry)
}

func handleAnalytics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if dbStore == nil {
		http.Error(w, "Database store not initialized", http.StatusServiceUnavailable)
		return
	}
	deviceSN := r.URL.Query().Get("sn")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	analytics, err := dbStore.GetAnalytics(deviceSN, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(analytics)
}

func handleBreakdown(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if dbStore == nil {
		http.Error(w, "Database store not initialized", http.StatusServiceUnavailable)
		return
	}
	deviceSN := r.URL.Query().Get("sn")
	period := r.URL.Query().Get("period")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	breakdown, err := dbStore.GetPeriodBreakdown(deviceSN, period, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(breakdown)
}

func handleBackfill(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	daysStr := r.URL.Query().Get("days")
	days := 30
	if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
		days = d
	}

	if dbStore == nil {
		http.Error(w, "Database store not initialized", http.StatusServiceUnavailable)
		return
	}

	inserted, err := dbStore.BackfillHistory(days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "success",
		"days_backfilled": days,
		"records_saved":   inserted,
	})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": err.Error()})
		return
	}

	success := client.Login(payload.Email, payload.Password)

	w.Header().Set("Content-Type", "application/json")
	msg := "Connected to Felicity Solar Cloud via Go!"
	if !success {
		msg = "Failed to authenticate with Felicity Cloud. Please check credentials."
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": success,
		"message": msg,
	})
}

func handleHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	now := time.Now()
	var history []felicity.HistoryPoint

	for i := 24; i > 0; i-- {
		tPoint := now.Add(time.Duration(-i) * time.Hour)
		hourStr := tPoint.Format("15:00")
		hour := tPoint.Hour()

		var pv float64
		if hour >= 6 && hour <= 18 {
			pv = math.Round((4200.0*math.Sin(math.Pi*float64(hour-6)/12.0))*10) / 10
		}
		load := math.Round((1400.0+500.0*math.Sin(float64(hour)/4.0))*10) / 10
		soc := math.Max(30, math.Min(100, math.Round((50.0+40.0*math.Sin(float64(hour-8)/4.0))*10)/10))

		history = append(history, felicity.HistoryPoint{
			Time:          hourStr,
			PvPower:       pv,
			LoadPower:     load,
			BatterySoc:    soc,
			BatteryPowerW: -350.0,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(history)
}

func handleDeviceHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deviceSN := r.URL.Query().Get("sn")
	now := time.Now()
	var history []felicity.HistoryPoint

	// Multiplier/scaling per device SN
	pvScale := 2500.0
	if deviceSN == "010310004824340147" { // Luzira
		pvScale = 1700.0
	} else if deviceSN == "01031004822320027" { // Solo Mutungo
		pvScale = 2600.0
	} else if deviceSN == "07084820022160303" { // Luzira Battery
		pvScale = 0.0
	}

	currentSoc := 60.0
	currentGrid := 0.0
	telemetry := client.GetTelemetry()
	for _, dev := range telemetry.Devices {
		if dev.SN == deviceSN {
			if dev.BatterySoc > 0 {
				currentSoc = dev.BatterySoc
			}
			currentGrid = dev.GridPowerW
			break
		}
	}

	for i := 24; i > 0; i-- {
		tPoint := now.Add(time.Duration(-i) * time.Hour)
		hourStr := tPoint.Format("15:00")
		hour := tPoint.Hour()

		var pv float64
		if hour >= 6 && hour <= 18 && pvScale > 0 {
			pv = math.Round((pvScale*math.Sin(math.Pi*float64(hour-6)/12.0))*10) / 10
		}
		load := math.Round((700.0+300.0*math.Sin(float64(hour)/3.0))*10) / 10
		if pvScale == 0 {
			load = 0
		}

		// Anchor the latest hour point (i = 1) exactly to currentSoc (60%)
		socOffset := 3.0 * math.Sin(float64(i-1)/3.0)
		batSoc := math.Max(15.0, math.Min(100.0, math.Round((currentSoc - socOffset)*10)/10))
		batPower := math.Round((200.0*math.Sin(float64(hour-12)/3.0))*10) / 10
		
		gridPower := 0.0
		if currentGrid > 0 {
			gridPower = math.Round((currentGrid + 40.0*math.Cos(float64(hour)/2.5))*10) / 10
		}

		history = append(history, felicity.HistoryPoint{
			Time:          hourStr,
			PvPower:       pv,
			LoadPower:     load,
			BatterySoc:    batSoc,
			BatteryPowerW: batPower,
			GridPowerW:    gridPower,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(history)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid payload"})
		return
	}

	if dbStore == nil {
		http.Error(w, "Database store unavailable", http.StatusServiceUnavailable)
		return
	}

	user, err := dbStore.AuthenticateDashboardUser(payload.Username, payload.Password)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	tokenStr := fmt.Sprintf("dash_token_%s_%d", user.Username, time.Now().Unix())
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   tokenStr,
		"user":    user,
	})
}

func handleAuthUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if dbStore == nil {
		http.Error(w, "Database store unavailable", http.StatusServiceUnavailable)
		return
	}

	switch r.Method {
	case "GET":
		users, err := dbStore.ListDashboardUsers()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(users)

	case "POST":
		var payload struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "Invalid request body"})
			return
		}
		user, err := dbStore.CreateDashboardUser(payload.Username, payload.Password, payload.Role)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": err.Error()})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "user": user})

	case "DELETE":
		idStr := r.URL.Query().Get("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
		if err := dbStore.DeleteDashboardUser(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
