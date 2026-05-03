import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { testsApi, materialsApi } from '../services/api'
import Badge from '../components/ui/Badge'
import type { MaterialTest, TestStatus } from '../types'

const STATUS_VARIANT: Record<TestStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pending: 'neutral', in_progress: 'info', completed: 'success',
  anomaly: 'warning', rejected: 'danger',
}
const STATUS_LABEL: Record<TestStatus, string> = {
  pending: 'En attente', in_progress: 'En cours', completed: 'Terminé',
  anomaly: 'Anomalie', rejected: 'Rejeté',
}

function CreateTestModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm()
  const { data: mats } = useQuery({
    queryKey: ['materials-all'],
    queryFn: () => materialsApi.list({ page_size: 100 }),
  })

  const mut = useMutation({
    mutationFn: (d: any) => testsApi.create(d),
    onSuccess: () => {
      toast.success('Essai créé — analyse IA en cours...')
      qc.invalidateQueries({ queryKey: ['tests'] })
      qc.invalidateQueries({ queryKey: ['test-stats'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Nouvel essai de résistance</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit(d => mut.mutate(d))} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">Matériau *</label>
            <select {...register('material_id', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">— Sélectionner —</option>
              {mats?.items.map(m => <option key={m.id} value={m.id}>{m.name} ({m.reference})</option>)}
            </select>
          </div>

          {[
            { name: 'age_days', label: 'Âge (jours)', type: 'number' },
            { name: 'compressive_strength_mpa', label: 'fc mesurée (MPa) *', type: 'number' },
            { name: 'load_kn', label: 'Charge (kN)', type: 'number' },
            { name: 'area_mm2', label: 'Section (mm²)', type: 'number' },
            { name: 'density_kg_m3', label: 'Densité (kg/m³)', type: 'number' },
            { name: 'water_cement_ratio', label: 'E/C ratio', type: 'number', step: '0.01' },
            { name: 'temperature_c', label: 'Température conservation (°C)', type: 'number' },
            { name: 'humidity_pct', label: 'Humidité (%)', type: 'number' },
          ].map(f => (
            <div key={f.name}>
              <label className="text-xs font-medium text-slate-600">{f.label}</label>
              <input
                {...register(f.name, { valueAsNumber: true })}
                type={f.type}
                step={f.step ?? 'any'}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          ))}

          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">Norme</label>
            <select {...register('test_norm')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              {['EN 12390', 'ASTM C39', 'ISO 1920', 'NF EN 206', 'ASTM A370', 'OTHER'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea {...register('notes')} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>

          <div className="col-span-2">
            <button
              type="submit"
              disabled={mut.isPending}
              className="w-full bg-primary-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-60"
            >
              {mut.isPending ? 'Création & analyse IA...' : 'Créer l\'essai'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TestRow({ test }: { test: MaterialTest }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`hover:bg-slate-50 cursor-pointer ${test.is_anomaly ? 'bg-amber-50' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {test.is_anomaly && <AlertTriangle size={14} className="text-amber-500" />}
            <span className="font-mono text-xs text-primary-700">{test.reference}</span>
          </div>
        </td>
        <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[test.status]}>{STATUS_LABEL[test.status]}</Badge></td>
        <td className="px-4 py-3 text-sm">{test.age_days ? `${test.age_days}j` : '—'}</td>
        <td className="px-4 py-3 font-semibold text-sm">{test.compressive_strength_mpa ? `${test.compressive_strength_mpa} MPa` : '—'}</td>
        <td className="px-4 py-3 text-sm text-amber-600">
          {test.predicted_28d_mpa ? `${test.predicted_28d_mpa} MPa` : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-slate-400">{test.test_norm}</td>
        <td className="px-4 py-3 text-xs text-slate-400">
          {new Date(test.created_at).toLocaleDateString('fr-FR')}
        </td>
        <td className="px-4 py-3 text-slate-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
              <div><span className="font-medium">Densité :</span> {test.density_kg_m3 ? `${test.density_kg_m3} kg/m³` : '—'}</div>
              <div><span className="font-medium">E/C ratio :</span> {test.water_cement_ratio ?? '—'}</div>
              <div><span className="font-medium">Temp. :</span> {test.temperature_c ? `${test.temperature_c} °C` : '—'}</div>
              <div><span className="font-medium">Humidité :</span> {test.humidity_pct ? `${test.humidity_pct}%` : '—'}</div>
              <div><span className="font-medium">Score anomalie :</span> {test.anomaly_score ?? '—'}</div>
              <div><span className="font-medium">Confiance IA :</span> {test.prediction_confidence ? `${test.prediction_confidence}%` : '—'}</div>
              {test.anomaly_reason && (
                <div className="col-span-3 text-amber-700 font-medium">⚠ {test.anomaly_reason}</div>
              )}
              {test.notes && <div className="col-span-3 text-slate-500 italic">{test.notes}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function TestsPage() {
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [anomalyOnly, setAnomalyOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['tests', page, statusFilter, anomalyOnly],
    queryFn: () => testsApi.list({
      page, page_size: 20,
      status: statusFilter || undefined,
      is_anomaly: anomalyOnly || undefined,
    }),
    refetchInterval: 10000,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Essais de résistance</h2>
          <p className="text-slate-500 text-sm">{data?.total ?? 0} essais — analyse IA automatique</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800"
        >
          <Plus size={16} /> Nouvel essai
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <select
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox" checked={anomalyOnly}
            onChange={e => { setAnomalyOnly(e.target.checked); setPage(1) }}
            className="rounded"
          />
          Anomalies uniquement
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Référence', 'Statut', 'Âge', 'fc mesurée', 'fc préd. 28j', 'Norme', 'Date', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Chargement...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Aucun essai trouvé</td></tr>
            ) : data?.items.map(t => <TestRow key={t.id} test={t} />)}
          </tbody>
        </table>

        {data && data.total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Page {page} / {Math.ceil(data.total / 20)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">←</button>
              <button disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>

      {showModal && <CreateTestModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
