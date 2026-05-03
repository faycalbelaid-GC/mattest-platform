import clsx from 'clsx'
import type { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  color?: 'blue' | 'green' | 'amber' | 'red'
  trend?: { value: number; label: string }
}

const colors = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

export default function StatCard({ title, value, subtitle, icon, color = 'blue', trend }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border p-5 flex flex-col gap-2', colors[color])}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{title}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
      {trend && (
        <div className={clsx('text-xs font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
          {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  )
}
