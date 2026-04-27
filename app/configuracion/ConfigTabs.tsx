'use client'

import { useState } from 'react'
import type { Negocio, Cliente, Transaccion, EstadisticasNegocio } from '@/lib/types'
import { EstadisticasTab } from './tabs/EstadisticasTab'
import { ClientesTab }     from './tabs/ClientesTab'
import { ConfigTab }       from './tabs/ConfigTab'

interface Props {
  negocio:       Negocio
  stats:         EstadisticasNegocio
  clientes:      Cliente[]
  transacciones: (Transaccion & { clientes: { nombre: string } | null })[]
}

// ================================================================
// ConfigTabs — Navegación entre las 3 secciones del panel admin
// ================================================================
// Componente de navegación puro: solo gestiona qué tab está activo.
// Cada tab recibe sus datos como props desde el Server Component padre,
// por lo que no hay ningún fetch adicional desde el cliente.
//
// Tabs:
//   📊 Estadísticas — métricas, gráfica por día, últimas transacciones
//   👥 Clientes     — registro de nuevos clientes + lista con toggle
//   ⚙️  Config       — nombre, color, logo del negocio
//
// La tab activa se subraya con el color_principal del negocio para
// mantener la identidad visual consistente con el POS.
// ================================================================

type TabId = 'stats' | 'clientes' | 'config'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'stats',    label: 'Estadísticas', icon: '📊' },
  { id: 'clientes', label: 'Clientes',     icon: '👥' },
  { id: 'config',   label: 'Config',       icon: '⚙️'  },
]

export function ConfigTabs({ negocio, stats, clientes, transacciones }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('stats')
  const color = negocio.color_principal

  return (
    <div className="space-y-5">
      {/* ── Navegación de tabs ────────────────────────────────── */}
      <nav className="flex bg-white rounded-2xl border border-gray-100 p-1 gap-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                py-2.5 rounded-xl text-sm font-semibold transition
                ${isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}
              `}
              style={isActive ? { backgroundColor: color } : {}}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Contenido del tab activo ──────────────────────────── */}
      {activeTab === 'stats' && (
        <EstadisticasTab
          stats={stats}
          transacciones={transacciones}
          color={color}
        />
      )}
      {activeTab === 'clientes' && (
        <ClientesTab
          clientes={clientes}
          color={color}
        />
      )}
      {activeTab === 'config' && (
        <ConfigTab negocio={negocio} />
      )}
    </div>
  )
}
