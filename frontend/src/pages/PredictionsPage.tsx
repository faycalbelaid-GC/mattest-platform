import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { Brain, Info } from 'lucide-react'
import { predictionsApi } from '../services/api'
import type { PredictionResponse } from '../types'

const schema = z.object({
  age_days: z.number({ invalid_type_error: 'Requis' }).int().min(1).max(28),
  compressive_strength_mpa: z.number({ invalid_type_error: 'Requis' }).positive(),
  water_cement_ratio: z.number().min(0.2).max(1).optional(),
  temperature_c: z.number().min(0).max(60).optional(),
  humidity_pct: z.number().min(0).max(100).optional(),
  cement_content_kg_m3: z.number().min(100).max(600).optional(),
})
type FormData = z.infer<typeof schema>

function ConfidenceGauge({ value }: { value: number }) {
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={`${value * 2.513} ${251.3}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center rotate-90">
          <span className="text-2xl font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-500">Confiance IA</span>
    </div>
  )
}

export default function PredictionsPage() {
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const { data: modelInfo } = useQuery({ queryKey: ['model-info'], queryFn: predictionsApi.modelInfo })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { age_days: 7, temperature_c: 20, humidity_pct: 95, water_cement_ratio: 0.45 },
  })

  const mut = useMutation({
    mutationFn: predictionsApi.predict,
    onSuccess: setResult,
  })

  const chartData = result
    ? [
        { age: '7j', value: parseFloat((result.predicted_28d_mpa * 0.65).toFixed(1)) },
        { age: '14j', value: parseFloat((result.predicted_28d_mpa * 0.85).toFixed(1)) },
        { age: '28j (préd.)', value: result.predicted_28d_mpa, ci_low: result.confidence_interval_lower, ci_high: result.confidence_interval_upper },
      ]
    : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain size={28} className="text-primary-700" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Prédictions IA — Résistance 28 jours</h2>
          <p className="text-slate-500 text-sm">Modèle : {modelInfo?.algorithm ?? '...'} — R² = {modelInfo?.r2_score?.toFixed(3) ?? '...'}</p>
        </div>
      </div>

      {/* Model info banner */}
      {modelInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>{modelInfo.algorithm}</strong> — v{modelInfo.version} — entraîné sur {modelInfo.n_samples?.toLocaleString()} éprouvettes
            {modelInfo.rmse && <> — RMSE = {modelInfo.rmse.toFixed(2)} MPa</>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Paramètres de l'essai</h3>
          <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-3">
            {[
              { name: 'compressive_strength_mpa' as const, label: 'fc mesurée à l\'âge considéré (MPa)', required: true },
              { name: 'age_days' as const, label: 'Âge de l\'éprouvette (jours, 1–28)', required: true },
              { name: 'water_cement_ratio' as const, label: 'Rapport E/C (ex: 0.45)' },
              { name: 'temperature_c' as const, label: 'Température de conservation (°C)' },
              { name: 'humidity_pct' as const, label: 'Humidité de conservation (%)' },
              { name: 'cement_content_kg_m3' as const, label: 'Dosage en ciment (kg/m³)' },
            ].map(f => (
              <div key={f.name}>
                <label className="text-xs font-medium text-slate-600">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  {...register(f.name, { valueAsNumber: true })}
                  type="number" step="any"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                {errors[f.name] && <p className="text-red-500 text-xs">{errors[f.name]?.message}</p>}
              </div>
            ))}

            <button
              type="submit"
              disabled={mut.isPending}
              className="w-full bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Brain size={16} />
              {mut.isPending ? 'Analyse en cours...' : 'Prédire fc à 28 jours'}
            </button>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Résultat de la prédiction</h3>

            <div className="flex items-center justify-around">
              <ConfidenceGauge value={Math.round(result.confidence_pct)} />
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-700">{result.predicted_28d_mpa}</div>
                <div className="text-sm text-slate-500">MPa à 28 jours</div>
                <div className="text-xs text-slate-400 mt-1">
                  IC 95% : [{result.confidence_interval_lower} — {result.confidence_interval_upper}] MPa
                </div>
              </div>
            </div>

            {/* Strength development chart */}
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2">Évolution de la résistance estimée</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" MPa" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Concrete class estimation */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <strong>Classe béton estimée (EN 206) :</strong>{' '}
              {result.predicted_28d_mpa >= 50 ? 'C40/50 ou supérieur' :
               result.predicted_28d_mpa >= 40 ? 'C32/40' :
               result.predicted_28d_mpa >= 30 ? 'C25/30' :
               result.predicted_28d_mpa >= 20 ? 'C16/20' : '< C16/20'}
            </div>
          </div>
        )}
      </div>

      {/* Maturity method explanation */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-2">Méthode utilisée : CEB-FIP + Gradient Boosting</h3>
        <div className="text-xs text-slate-600 space-y-1">
          <p>• <strong>Correction maturité (CEB-FIP 1990)</strong> : fc₂₈ = fc_t / exp[s·(1 - √(28/t))]  avec s ≈ 0.25 (CEM I)</p>
          <p>• <strong>Indice de maturité Nurse-Saul</strong> : M = Σ(T − T₀)·Δt  avec T₀ = −10 °C</p>
          <p>• <strong>Modèle IA</strong> : Gradient Boosting Regressor (GBR) entraîné sur données synthétiques EN 206 C20–C50</p>
          <p>• <strong>Résistance caractéristique</strong> : fck = fc,moy − 1.645·σ  (EN 206 §8.2)</p>
        </div>
      </div>
    </div>
  )
}
