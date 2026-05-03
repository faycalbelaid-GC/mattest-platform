export type UserRole = 'admin' | 'engineer' | 'technician' | 'viewer'
export type MaterialType = 'concrete' | 'steel' | 'asphalt' | 'soil' | 'aggregate' | 'cement' | 'other'
export type TestStatus = 'pending' | 'in_progress' | 'completed' | 'anomaly' | 'rejected'
export type TestNorm = 'EN 12390' | 'ASTM C39' | 'ISO 1920' | 'NF EN 206' | 'ASTM A370' | 'OTHER'
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type ReportFormat = 'pdf' | 'excel' | 'json'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  user: User
}

export interface Material {
  id: string
  name: string
  reference: string
  material_type: MaterialType
  description?: string
  supplier?: string
  batch_number?: string
  manufacturing_date?: string
  specifications: Record<string, unknown>
  version: number
  created_at: string
}

export interface Prediction {
  id: string
  model_name?: string
  model_version?: string
  predicted_value: number
  target_age_days: number
  confidence_interval_lower?: number
  confidence_interval_upper?: number
  created_at: string
}

export interface MaterialTest {
  id: string
  reference: string
  material_id: string
  test_norm: TestNorm
  status: TestStatus
  sample_id?: string
  age_days?: number
  temperature_c?: number
  humidity_pct?: number
  water_cement_ratio?: number
  specimen_dimensions?: Record<string, number>
  load_kn?: number
  area_mm2?: number
  compressive_strength_mpa?: number
  density_kg_m3?: number
  is_anomaly: boolean
  anomaly_score?: number
  anomaly_reason?: string
  predicted_28d_mpa?: number
  prediction_confidence?: number
  tested_at?: string
  created_at: string
  notes?: string
  predictions: Prediction[]
}

export interface TestStats {
  total_tests: number
  completed_tests: number
  anomaly_count: number
  avg_strength_mpa?: number
  min_strength_mpa?: number
  max_strength_mpa?: number
  std_strength_mpa?: number
  conformity_rate?: number
}

export interface PredictionRequest {
  age_days: number
  compressive_strength_mpa: number
  water_cement_ratio?: number
  temperature_c?: number
  humidity_pct?: number
  cement_content_kg_m3?: number
}

export interface PredictionResponse {
  predicted_28d_mpa: number
  confidence_interval_lower: number
  confidence_interval_upper: number
  confidence_pct: number
  model_name: string
  model_version: string
  input_features: Record<string, unknown>
}

export interface Report {
  id: string
  title: string
  report_type?: string
  norm?: string
  status: ReportStatus
  format: ReportFormat
  test_ids: string[]
  material_ids: string[]
  file_size_bytes?: number
  created_at: string
  completed_at?: string
  error_message?: string
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface WsMessage {
  type: 'anomaly_detected' | 'test_completed' | 'report_ready'
  timestamp: string
  [key: string]: unknown
}
