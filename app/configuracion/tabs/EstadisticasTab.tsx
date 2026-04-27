'use client'

import type { EstadisticasNegocio, Transaccion } from '@/lib/types'

interface Props {
  stats: EstadisticasNegocio
  transacciones: (Transaccion & { clientes: { nombre: string } | null })[]
  color: string
}

// ================================================================
// EstadisticasTab — Dashboard de métricas del negocio
// ================================================================
// Muestra los datos pre-cargados por el Server Component (sin fetch
// adicional desde el cliente), organizados en 3 secciones:
//
// 1. KPI Cards — 4 métricas rápidas en tarjetas de color
// 2. Gráfica de barras SVG — cobros vs recargas por día (últimos 30d)
// 3. Tabla de transacciones recientes (últimas 20)
//
// GRÁFICA SVG:
//   - Sin dependencias externas (recharts, chart.js, etc.)
//   - Barras agrupadas: gris oscuro = cobros | color del negocio = recargas
//   - viewBox responsive: escala con el ancho del contenedor
//   - El eje Y se normaliza al valor máximo del período para escalar
//     correctamente aunque los montos varíen mucho entre días
//   - Tooltip nativo con <title> SVG (accesible, sin JS extra)
//
// TABLA DE TRANSACCIONES:
//   - Muestra las últimas 20 operaciones con nombre del cliente
//   - Badge de color: verde = recarga, gris = cobro
//   - Saldo anterior → saldo posterior para auditoría visual rápida
// ================================================================
export function EstadisticasTab({ stats, transacciones, color }: Props) {
  const porDia = stats.por_dia ?? []

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Cobros 30 días"
          value={formatMXN(stats.total_cobros)}
          icon="💸"
          bg="bg-gray-900"
          text="text-white"
        />
        <KpiCard
          label="Recargas 30 días"
          value={formatMXN(stats.total_recargas)}
          icon="⚡"
          bg=""
          text="text-white"
          style={{ backgroundColor: color }}
        />
        <KpiCard
          label="Transacciones"
          value={String(stats.num_transacciones)}
          icon="🔄"
          bg="bg-indigo-50"
          text="text-indigo-800"
        />
        <KpiCard
          label="Clientes activos"
          value={String(stats.num_clientes_activos)}
          icon="👥"
          bg="bg-emerald-50"
          text="text-emerald-800"
        />
      </div>

      {/* ── Gráfica de barras ─────────────────────────────────── */}
      {porDia.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Actividad diaria</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block" />
                Cobros
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                Recargas
              </span>
            </div>
          </div>
          <BarChart data={porDia} color={color} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          Sin actividad en los últimos 30 días
        </div>
      )}

      {/* ── Transacciones recientes ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">Transacciones recientes</h3>
        </div>

        {transacciones.length === 0 ? (
          <p className="px-5 py-10 text-center text-gray-400">Sin transacciones aún</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {transacciones.map(tx => (
              <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                {/* Badge tipo */}
                <span className={`
                  flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold
                  ${tx.tipo === 'recarga'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-700'}
                `}>
                  {tx.tipo === 'recarga' ? '⚡ Recarga' : '💸 Cobro'}
                </span>

                {/* Cliente */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {tx.clientes?.nombre ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.creado_en).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Monto y saldo */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${
                    tx.tipo === 'recarga' ? 'text-emerald-600' : 'text-gray-900'
                  }`}>
                    {tx.tipo === 'recarga' ? '+' : '-'}{formatMXN(tx.monto)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Saldo: {formatMXN(tx.saldo_posterior)}
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

// ── KPI Card ────────────────────────────────────────────────────
function KpiCard({ label, value, icon, bg, text, style }: {
  label: string; value: string; icon: string
  bg: string; text: string; style?: React.CSSProperties
}) {
  return (
    <div className={`rounded-2xl p-4 ${bg} ${text}`} style={style}>
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-xs opacity-70 mt-1">{label}</p>
    </div>
  )
}

// ── Gráfica de barras SVG sin dependencias ──────────────────────
type DiaStats = { dia: string; cobros: number; recargas: number; total_ops: number }

function BarChart({ data, color }: { data: DiaStats[]; color: string }) {
  // Mostrar últimos 14 días para que las barras sean legibles en móvil
  const slice  = data.slice(-14)
  const maxVal = Math.max(...slice.flatMap(d => [d.cobros, d.recargas]), 1)

  const W         = 320   // viewBox width
  const H         = 110   // viewBox height
  const BOTTOM    = 20    // espacio para etiquetas de fecha
  const CHART_H   = H - BOTTOM
  const BAR_W     = 8
  const BAR_GAP   = 3     // gap entre barra cobro y barra recarga
  const GROUP_GAP = 6     // gap entre grupos de días
  const GROUP_W   = BAR_W * 2 + BAR_GAP + GROUP_GAP

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Gráfica de cobros y recargas por día"
    >
      {slice.map((d, i) => {
        const x      = i * GROUP_W
        const cobH   = (d.cobros   / maxVal) * CHART_H
        const recH   = (d.recargas / maxVal) * CHART_H
        const fecha  = new Date(d.dia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

        return (
          <g key={d.dia} transform={`translate(${x}, 0)`}>
            {/* Barra cobros (gris oscuro) */}
            <rect
              x={0} y={CHART_H - cobH} width={BAR_W} height={Math.max(cobH, 1)}
              fill="#1f2937" rx="2"
            >
              <title>{fecha} · Cobros: {formatMXN(d.cobros)}</title>
            </rect>

            {/* Barra recargas (color del negocio) */}
            <rect
              x={BAR_W + BAR_GAP} y={CHART_H - recH} width={BAR_W} height={Math.max(recH, 1)}
              fill={color} rx="2"
            >
              <title>{fecha} · Recargas: {formatMXN(d.recargas)}</title>
            </rect>

            {/* Etiqueta de fecha — cada 3 días para no saturar */}
            {i % 3 === 0 && (
              <text
                x={BAR_W} y={H - 4}
                textAnchor="middle"
                fontSize="7"
                fill="#9ca3af"
              >
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
