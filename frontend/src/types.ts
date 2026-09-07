export interface DeviceItem {
  sn: string;
  alias: string;
  model: string;
  type: string;
  type_name: string;
  status: string;
  rated_power_kw: string;
  country: string;
  timezone: string;
  pv_power_w: number;
  pv_voltage_v: number;
  pv_current_a?: number;
  load_power_w: number;
  load_current_a?: number;
  battery_soc: number;
  battery_power_w: number;
  battery_current_a?: number;
  battery_voltage_v?: number;
  grid_power_w?: number;
  grid_voltage_v?: number;
  collector_sn: string;
  firmware_version: string;
  plant_name: string;
  plant_id: string;
  id: string;
}

export interface TelemetryResponse {
  timestamp: string;
  is_live: boolean;
  configured: boolean;
  plant_info: {
    name: string;
    total_devices: number;
    status: string;
  };
  solar: {
    power_w: number;
    voltage_v: number;
    current_a: number;
  };
  battery: {
    soc_percent: number;
    power_w: number;
    voltage_v: number;
    status: string;
  };
  load: {
    power_w: number;
    voltage_v: number;
    frequency_hz: number;
  };
  grid: {
    power_w: number;
    voltage_v: number;
    status: string;
  };
  system: {
    inverter_temp_c: number;
    health_status: string;
  };
  devices: DeviceItem[];
}

export interface HistoryPoint {
  time: string;
  pv_power: number;
  load_power: number;
  battery_soc: number;
  battery_power_w?: number;
  grid_power_w?: number;
}

export interface SavingsAnalytics {
  total_solar_kwh: number;
  total_load_kwh: number;
  total_grid_kwh: number;
  total_savings_ugx: number;
  total_savings_usd: number;
  solar_self_sufficiency_pct: number;
  total_records_synced: number;
  earliest_record: string;
  latest_record: string;
}

export interface PeriodItem {
  period_label: string;
  solar_kwh: number;
  load_kwh: number;
  grid_kwh: number;
  savings_ugx: number;
  savings_usd: number;
}

export interface PeriodBreakdownResponse {
  device_sn: string;
  period: string;
  items: PeriodItem[];
}

export interface DashboardUser {
  id: number;
  username: string;
  role: string;
  created_at?: string;
}
