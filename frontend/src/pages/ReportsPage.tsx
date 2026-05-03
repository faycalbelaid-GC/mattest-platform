import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FileText, Download, Plus, X, RefreshCw } from 'lucide-react'
import { reportsApi, testsApi, materialsApi } from '../services/api'
import Badge from '../components/ui/Badge'
import type { ReportStatus, Report } from '../types'

const STATUS_VARIANT: Record<ReportStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  pending: 'neutral', generating: 'info', ready: 'success', failed: 'danger',
}
const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: 'En attente', generating: 'Génération...', ready: 'Prêt', failed: 'Erreur',
}

function ReportRow({ report }: { report: Report }) {
  const isReady = report.status === 'ready'
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-sm text-slate-800">{report.title}</div>
        <div className="text-xs text-slate-400">{report.norm ?? '—'}</div>
      </td>
      <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[report.status]}>{STATUS_LABEL[report.status]}</Badge></td>
      <td className="px-4 py-3 text-xs text-slate-500">{report.test_ids.length} essai(s)</td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {new Date(report.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {report.file_size_bytes ? `${(report.file_size_bytes / 1024).toFixed(1)} KB` : '—'}
      </td>
      <td className="px-4 py-3">
        {isReady && (
          <a
            href={reportsApi.downloadUrl(report.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-primary-600 hover:text-primary-800 text-xs font-medium"
          >
            <Download size={14} /> Télécharger PDF
          </a>
        )}
        {report.status === 'failed' && (
          <span className="text-red-500 text-xs">{report.error_message?.slice(0, 50)}</span>
        )}
        {report.status === 'generating' && (
          <span className="flex items-center gap-1 text-blue-500 text-xs">
            <RefreshCw size={12} className="animate-spin" /> Génération...
          </span>
        )}
      </td>
    </tr>
  )
}

function CreateReportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit } = useForm()
  const { data: tests } = useQuery({ queryKey: ['tests-all'], queryFn: () => testsApi.list({ page_size: 100 }) })
  const { data: mats } = useQuery({ queryKey: ['materials-all'], queryFn: () => materialsApi.list({ page_size: 100 }) })

  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [selectedMats, setSelectedMats] = useState<string[]>([])

  const toggleTest = (id: string) => setSelectedTests(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleMat = (id: string) => setSelectedMats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const mut = useMutation({
    mutationFn: (d: any) => reportsApi.create({ ...d, test_ids: selectedTests, material_ids: selectedMats }),
    onSuccess: () => {
      toast.success('Rapport en cours de génération...')
      qc.invalidateQueries({ queryKey: ['reports'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Générer un rapport PDF</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Titre du rapport *</label>
            <input {...register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Rapport essais béton C25/30 — Lot 2024-01" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Norme de référence</label>
            <select {...register('norm')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              {['EN 12390', 'ASTM C39', 'ISO 1920', 'NF EN 206'].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Essais à inclure ({selectedTests.length} sélectionnés)</label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {tests?.items.map(t => (
                <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedTests.includes(t.id)} onChange={() => toggleTest(t.id)} />
                  <span className="text-xs">
                    <span className="font-mono text-primary-700">{t.reference}</span>
                    {t.compressive_strength_mpa && <> — {t.compressive_strength_mpa} MPa</>}
                    {t.age_days && <> ({t.age_days}j)</>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Matériaux à inclure ({selectedMats.length} sélectionnés)</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {mats?.items.map(m => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedMats.includes(m.id)} onChange={() => toggleMat(m.id)} />
                  <span className="text-xs"><span className="font-mono text-primary-700">{m.reference}</span> — {m.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={mut.isPending || selectedTests.length === 0}
            className="w-full bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-60"
          >
            {mut.isPending ? 'Lancement...' : 'Générer le rapport PDF'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: reportsApi.list,
    refetchInterval: 5000,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-primary-700" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Rapports certifiés</h2>
            <p className="text-slate-500 text-sm">Génération PDF conforme EN 12390 / ASTM C39 / ISO 1920</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800"
        >
          <Plus size={16} /> Nouveau rapport
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Titre / Norme', 'Statut', 'Essais', 'Créé le', 'Taille', 'Action'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Chargement...</td></tr>
            ) : reports?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Aucun rapport — créez-en un !</td></tr>
            ) : reports?.map(r => <ReportRow key={r.id} report={r} />)}
          </tbody>
        </table>
      </div>

      {showModal && <CreateReportModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
