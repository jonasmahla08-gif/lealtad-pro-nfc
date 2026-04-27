'use client'

import type { EstadisticasNegocio, Transaccion } from '@/lib/types'

interface Props {
  stats: EstadisticasNegocio
  transacciones: (Transaccion & { clientes: { nombre: string } | null })[]
  color: string
}

export function EstadisticasTab({ stats, transacciones, color }: Props) {
  const porDia = stats.por_dia ?? []

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cobros */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div className="absolute top-3 right-3 text-2xl opacity-30">💸</div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
             style={{ color: 'rgba(255,255,255,0.45)' }}>Cobros 30d</p>
          <p className="text-2xl font-black text-white">{formatMXN(stats.total_cobros)}</p>
        </div>

        {/* Recargas */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
             style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`,
                      boxShadow: `0 8px 32px ${color}50` }}>
          <div className="absolute top-3 right-3 text-2xl opacity-30">⚡</div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
             style={{ color: 'rgba(255,255,255,0.6)' }}>Recargas 30d</p>
          <p className="text-2xl font-black text-white">{formatMXN(stats.total_recargas)}</p>
        </div>

        {/* Transacciones */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                      boxShadow: '0 4px 16px rgba(139,92,246,0.12)' }}>
          <div className="absolute top-3 right-3 text-2xl opacity-25">🔄</div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
             style={{ color: '#7c3aed' }}>Transacciones</p>
          <p className="text-2xl font-black" style={{ color: '#4c1d95' }}>
            {stats.num_transacciones}
          </p>
        </div>

        {/* Clientes */}
        <div className="rounded-2xl p-5 relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.12)' }}>
          <div className="absolute top-3 right-3 text-2xl opacity-25">👥</div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
             style={{ color: '#065f46' }}>Clientes activos</p>
          <p className="text-2xl font-black" style={{ color: '#064e3b' }}>
            {stats.num_clientes_activos}
          </p>
        </div>
      </div>

      {/* ── Gráfica de barras ─────────────────────────────────── */}
      {porDia.length > 0 ? (
        <div className="bg-white rounded-2xl p-5"
             style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Actividad diaria</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-800 inline-block" />
                Cobros
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: color }} />
                Recargas
              </span>
            </div>
          </div>
          <BarChart data={porDia} color={color} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center"
             style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-400 font-medium">Sin actividad en los últimos 30 días</p>
        </div>
      )}

      {/* ── Transacciones recientes ───────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden"
           style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="font-bold text-gray-900">Transacciones recientes</h3>
        </div>

        {transacciones.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-3xl mb-3">🧾</p>
            <p className="text-gray-400">Sin transacciones aún</p>
          </div>
        ) : (
          <ul>
            {transacciones.map((tx, i) => (
              <li key={tx.id}
                  className="px-5 py-3.5 flex items-center gap-3"
                  style={{ borderBottom: i < transacciones.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                {/* Icono tipo */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                     style={{
                       background: tx.tipo === 'recarga'
                         ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                         : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                     }}>
                  {tx.tipo === 'recarga' ? '⚡' : '💸'}
                </div>

                {/* Cliente y fecha */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {tx.clientes?.nombre ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.creado_en).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Monto */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${
                    tx.tipo === 'recarga' ? 'text-emerald-600' : 'text-gray-800'
                  }`}>
                    {tx.tipo === 'recarga' ? '+' : '-'}{formatMXN(tx.monto)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    saldo {formatMXN(tx.saldo_posterior)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

type DiaStats = { dia: string; cobros: number; recargas: number; total_ops: number }

function BarChart({ data, color }: { data: DiaStats[]; color: string }) {
  const slice  = data.slice(-14)
  const maxVal = Math.max(...slice.flatMap(d => [d.cobros, d.recargas]), 1)

  const W         = 320
  const H         = 110
  const BOTTOM    = 20
  const CHART_H   = H - BOTTOM
  const BAR_W     = 8
  const BAR_GAP   = 3
  const GROUP_GAP = 6
  const GROUP_W   = BAR_W * 2 + BAR_GAP + GROUP_GAP

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfica de actividad">
      {slice.map((d, i) => {
        const x     = i * GROUP_W
        const cobH  = (d.cobros   / maxVal) * CHART_H
        const recH  = (d.recargas / maxVal) * CHART_H
        const fecha = new Date(d.dia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

        return (
          <g key={d.dia} transform={`translate(${x}, 0)`}>
            <rect x={0} y={CHART_H - cobH} width={BAR_W} height={Math.max(cobH, 2)}
                  fill="#334155" rx="2">
              <title>{fecha} · Cobros: {formatMXN(d.cobros)}</title>
            </rect>
            <rect x={BAR_W + BAR_GAP} y={CHART_H - recH} width={BAR_W} height={Math.max(recH, 2)}
                  fill={color} rx="2">
              <title>{fecha} · Recargas: {formatMXN(d.recargas)}</title>
            </rect>
            {i % 3 === 0 && (
              <text x={BAR_W} y={H - 4} textAnchor="middle" fontSize="7" fill="#94a3b8">
                {fecha}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function formatMXN(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })
}
