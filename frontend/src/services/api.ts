import axios from 'axios'
import type {
  AuthToken, User, Material, MaterialTest, TestStats,
  PredictionRequest, PredictionResponse, Report,
  PagedResponse,
} from '../types'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthToken>('/auth/login', { email, password }).then(r => r.data),
  register: (data: { email: string; full_name: string; password: string; role?: string }) =>
    api.post<User>('/auth/register', data).then(r => r.data),
  me: () => api.get<User>('/auth/me').then(r => r.data),
}

// Materials
export const materialsApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; material_type?: string }) =>
    api.get<PagedResponse<Material>>('/materials', { params }).then(r => r.data),
  get: (id: string) => api.get<Material>(`/materials/${id}`).then(r => r.data),
  create: (data: Partial<Material>) => api.post<Material>('/materials', data).then(r => r.data),
  update: (id: string, data: Partial<Material> & { change_reason?: string }) =>
    api.put<Material>(`/materials/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/materials/${id}`),
}

// Tests
export const testsApi = {
  list: (params?: { page?: number; page_size?: number; material_id?: string; status?: string; is_anomaly?: boolean }) =>
    api.get<PagedResponse<MaterialTest>>('/tests', { params }).then(r => r.data),
  get: (id: string) => api.get<MaterialTest>(`/tests/${id}`).then(r => r.data),
  create: (data: Partial<MaterialTest>) => api.post<MaterialTest>('/tests', data).then(r => r.data),
  update: (id: string, data: Partial<MaterialTest>) =>
    api.put<MaterialTest>(`/tests/${id}`, data).then(r => r.data),
  stats: () => api.get<TestStats>('/tests/stats').then(r => r.data),
}

// Predictions
export const predictionsApi = {
  predict: (req: PredictionRequest) =>
    api.post<PredictionResponse>('/predictions/predict', req).then(r => r.data),
  modelInfo: () => api.get('/predictions/model-info').then(r => r.data),
}

// Reports
export const reportsApi = {
  list: () => api.get<Report[]>('/reports').then(r => r.data),
  get: (id: string) => api.get<Report>(`/reports/${id}`).then(r => r.data),
  create: (data: { title: string; norm?: string; test_ids: string[]; material_ids: string[] }) =>
    api.post<Report>('/reports', data).then(r => r.data),
  downloadUrl: (id: string) => `/api/reports/${id}/download`,
}

export default api
