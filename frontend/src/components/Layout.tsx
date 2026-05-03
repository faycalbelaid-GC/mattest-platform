import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  LayoutDashboard, FlaskConical, Package, Brain,
  FileText, LogOut, Wifi, WifiOff,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { wsClient } from '../services/websocket'
import type { WsMessage } from '../types'

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/materials', label: 'Matériaux', icon: Package },
  { to: '/tests', label: 'Essais', icon: FlaskConical },
  { to: '/predictions', label: 'Prédictions IA', icon: Brain },
  { to: '/reports', label: 'Rapports', icon: FileText },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [])

  const handleWs = useCallback((msg: WsMessage) => {
    if (msg.type === 'anomaly_detected') {
      toast.error(`⚠ Anomalie détectée — ${msg.test_reference} : ${msg.fc_mpa} MPa\n${msg.reason}`, {
        duration: 8000,
      })
    } else if (msg.type === 'test_completed') {
      toast.success(`✓ Essai ${msg.test_reference} terminé — fc = ${msg.fc_mpa} MPa`)
    } else if (msg.type === 'report_ready') {
      toast.success(`📄 Rapport "${msg.title}" prêt au téléchargement`)
    }
  }, [])

  useWebSocket(handleWs)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-primary-700">
          <h1 className="text-lg font-bold tracking-tight">MatTest</h1>
          <p className="text-xs text-primary-300 mt-0.5">Essais Matériaux Intelligents</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary-700 text-white font-medium'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white',
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-primary-700">
          <div className="text-xs text-primary-300 mb-1">{user?.full_name}</div>
          <div className="text-xs text-primary-400 capitalize mb-3">{user?.role}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-primary-300 hover:text-white text-xs transition-colors"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
