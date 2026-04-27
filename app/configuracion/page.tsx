import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Negocio, Cliente, Transaccion, EstadisticasNegocio } from '@/lib/types'
import { ConfigTabs } from './ConfigTabs'
import { LogoutButtonClient } from '../super-admin/LogoutButtonClient'

// ================================================================
// /configuracion — Panel de Administración del Negocio
// ================================================================
// Server Component: hace TODOS los fetches en el servidor antes de
// renderizar. El cliente recibe los datos pre-cargados como props.
//
// Datos que carga:
//   - negocio:      info del tenant (color, logo, activo, etc.)
//   - stats:        agregados de los últimos 30 días (via RPC)
//   - clientes:     lista completa de clientes del negocio
//   - transacciones: últimas 20 operaciones con nombre del cliente
// ================================================================
export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: negocio } = await supabase
    .from('negocios')
    .select('*')
    .eq('owner_id', user.id)
    .single<Negocio>()

  if (!negocio) redirect('/configuracion/nuevo')

  // Estadísticas últimos 30 días (via RPC del schema)
  const desde = new Date()
  desde.setDate(desde.getDate() - 30)

  const [statsRes, clientesRes, txRes] = await Promise.all([
    supabase.rpc('estadisticas_negocio', {
      p_negocio_id: negocio.id,
      p_desde:      desde.toISOString(),
      p_hasta:      new Date().toISOString(),
    }),
    supabase
      .from('clientes')
      .select('id, negocio_id, nombre, telefono, nfc_id, saldo, activo, creado_en')
      .eq('negocio_id', negocio.id)
      .order('creado_en', { ascending: false }),
    // Últimas 20 transacciones con nombre del cliente via JOIN
    supabase
      .from('transacciones')
      .select('*, clientes(nombre)')
      .eq('negocio_id', negocio.id)
      .order('creado_en', { ascending: false })
      .limit(20),
  ])

  const stats:   EstadisticasNegocio     = statsRes.data   ?? { ok: false, total_cobros: 0, total_recargas: 0, num_transacciones: 0, num_clientes_activos: 0, por_dia: [] }
  const clientes: Cliente[]              = clientesRes.data ?? []
  const transacciones: (Transaccion & { clientes: { nombre: string } | null })[] = txRes.data ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10"
              style={{ borderBottomColor: negocio.color_principal + '40' }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {negocio.logo_url ? (
              <img src={negocio.logo_url} alt="Logo" className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                   style={{ backgroundColor: negocio.color_principal }}>
                {negocio.nombre[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-bold text-gray-900 leading-none text-sm">{negocio.nombre}</h1>
              <p className="text-xs text-gray-400">Panel de configuración</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/app"
               className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition"
               style={{ backgroundColor: negocio.color_principal }}>
              🏪 Ir al POS
            </a>
            <LogoutButtonClient />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <ConfigTabs
          negocio={negocio}
          stats={stats}
          clientes={clientes}
          transacciones={transacciones}
        />
      </main>
    </div>
  )
}
