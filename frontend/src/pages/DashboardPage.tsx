import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { FlaskConical, Package, AlertTriangle, TrendingUp } from 'lucide-react'
import { testsApi, materialsApi } from '../services/api'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import type { MaterialTest } from '../types'

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8', in_progress: '#3b82f6',
  completed: '#22c55e', anomaly: '#f59e0b', rejected: '#ef4444',
}

function buildStrengthHistory(tests: MaterialTest[]) {
  return tests
    .filter(t => t.compressive_strength_mpa && t.created_at)
    .slice(0, 30)
    .reverse()
    .map((t, i) => ({
      name: `#${i + 1}`,
      fc_mesurée: t.compressive_strength_mpa,
      fc_prédite_28j: t.predicted_28d_mpa,
    }))
}

function buildStatusDist(tests: MaterialTest[]) {
  const counts: Record<string, number> = {}
  tests.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1 })
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export default function DashboardPage() {
  const { data: stats } = useQuery({ queryKey: ['test-stats'], queryFn: testsApi.stats, refetchInterval: 15000 })
  const { data: testsData } = useQuery({ queryKey: ['tests-recent'], queryFn: () => testsApi.list({ page_size: 50 }), refetchInterval: 15000 })
  const { data: matData } = useQuery({ queryKey: ['materials-count'], queryFn: () => materialsApi.list({ page_size: 1 }) })

  const tests = testsData?.items ?? []
  const strengthHistory = buildStrengthHistory(tests)
  const statusDist = buildStatusDist(tests)
  const recentAnomalies = tests.filter(t => t.is_anomaly).slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tableau de bord</h2>
        <p className="text-slate-500 text-sm">Vue d'ensemble en temps réel — actualisé toutes les 15 s</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Essais totaux"
          value={stats?.total_tests ?? '—'}
          subtitle={`${stats?.completed_tests ?? 0} complétés`}
          icon={<FlaskConical size={20} />}
          color="blue"
        />
        <StatCard
          title="fc,moy (MPa)"
          value={stats?.avg_strength_mpa ? `${stats.avg_strength_mpa}` : '—'}
          subtitle={`σ = ${stats?.std_strength_mpa ?? '—'} MPa`}
          icon={<TrendingUp size={20} />}
          color="green"
        />
        <StatCard
          title="Anomalies"
          value={stats?.anomaly_count ?? '—'}
          subtitle="Détectées par IA"
          icon={<AlertTriangle size={20} />}
          color="amber"
        />
        <StatCard
          title="Matériaux"
          value={matData?.total ?? '—'}
          subtitle="Référencés"
          icon={<Package size={20} />}
          color="blue"
        />
      </div>

      {/* Conformité + Résistances */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Strength trend */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Évolution fc mesurée vs prédite 28j (MPa)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={strengthHistory}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" MPa" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="fc_mesurée" stroke="#3b82f6" fill="url(#gc)" strokeWidth={2} />
              <Area type="monotone" dataKey="fc_prédite_28j" stroke="#f59e0b" fill="none" strokeDasharray="4 2" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Répartition des statuts</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusDist.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent anomalies */}
      {recentAnomalies.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Anomalies récentes détectées par IA
          </h3>
          <div className="space-y-2">
            {recentAnomalies.map(t => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <Badge variant="warning">{t.reference}</Badge>
                <span className="text-slate-600">{t.compressive_strength_mpa} MPa</span>
                <span className="text-slate-400 text-xs">{t.anomaly_reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conformity */}
      {stats?.conformity_rate !== undefined && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="text-4xl font-bold text-primary-700">{stats.conformity_rate}%</div>
          <div>
            <div className="font-semibold text-slate-800">Taux de conformité EN 206</div>
            <div className="text-xs text-slate-500">fc,k = fc,moy − 1.645·σ / Classe résistance caractéristique</div>
          </div>
        </div>
      )}
    </div>
  )
}
