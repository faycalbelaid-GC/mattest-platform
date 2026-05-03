import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import { materialsApi } from '../services/api'
import Badge from '../components/ui/Badge'
import type { Material, MaterialType } from '../types'

const TYPES: MaterialType[] = ['concrete', 'steel', 'asphalt', 'soil', 'aggregate', 'cement', 'other']
const TYPE_LABELS: Record<MaterialType, string> = {
  concrete: 'Béton', steel: 'Acier', asphalt: 'Bitume',
  soil: 'Sol', aggregate: 'Granulat', cement: 'Ciment', other: 'Autre',
}

const schema = z.object({
  name: z.string().min(1),
  reference: z.string().min(1),
  material_type: z.enum(['concrete', 'steel', 'asphalt', 'soil', 'aggregate', 'cement', 'other']),
  supplier: z.string().optional(),
  batch_number: z.string().optional(),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function Modal({ onClose, material }: { onClose: () => void; material?: Material }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: material ? {
      name: material.name, reference: material.reference,
      material_type: material.material_type, supplier: material.supplier ?? '',
      batch_number: material.batch_number ?? '', description: material.description ?? '',
    } : undefined,
  })

  const createMut = useMutation({
    mutationFn: (d: FormData) => materialsApi.create(d),
    onSuccess: () => { toast.success('Matériau créé'); qc.invalidateQueries({ queryKey: ['materials'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })
  const updateMut = useMutation({
    mutationFn: (d: FormData) => materialsApi.update(material!.id, d),
    onSuccess: () => { toast.success('Matériau mis à jour'); qc.invalidateQueries({ queryKey: ['materials'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Erreur'),
  })

  const onSubmit = (d: FormData) => material ? updateMut.mutate(d) : createMut.mutate(d)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">{material ? 'Modifier' : 'Nouveau matériau'}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {(['name', 'reference', 'supplier', 'batch_number'] as const).map(field => (
            <div key={field}>
              <label className="text-xs font-medium text-slate-600 capitalize">{field.replace('_', ' ')}</label>
              <input {...register(field)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              {errors[field] && <p className="text-red-500 text-xs">{errors[field]?.message}</p>}
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-600">Type</label>
            <select {...register('material_type')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea {...register('description')} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <button
            type="submit"
            disabled={createMut.isPending || updateMut.isPending}
            className="w-full bg-primary-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-60"
          >
            {(createMut.isPending || updateMut.isPending) ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function MaterialsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<{ open: boolean; material?: Material }>({ open: false })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['materials', page, search, typeFilter],
    queryFn: () => materialsApi.list({ page, page_size: 15, search, material_type: typeFilter }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => materialsApi.delete(id),
    onSuccess: () => { toast.success('Supprimé'); qc.invalidateQueries({ queryKey: ['materials'] }) },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Matériaux</h2>
          <p className="text-slate-500 text-sm">{data?.total ?? 0} matériaux référencés</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800"
        >
          <Plus size={16} /> Nouveau
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par nom, référence..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tous les types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Référence', 'Nom', 'Type', 'Fournisseur', 'Lot', 'Version', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Chargement...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Aucun matériau trouvé</td></tr>
            ) : data?.items.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-primary-700">{m.reference}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                <td className="px-4 py-3"><Badge variant="info">{TYPE_LABELS[m.material_type]}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{m.supplier ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{m.batch_number ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">v{m.version}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ open: true, material: m })} className="text-primary-600 hover:text-primary-800">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => confirm('Supprimer ce matériau ?') && deleteMut.mutate(m.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Page {page} / {Math.ceil(data.total / 15)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">←</button>
              <button disabled={page >= Math.ceil(data.total / 15)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>

      {modal.open && <Modal onClose={() => setModal({ open: false })} material={modal.material} />}
    </div>
  )
}
