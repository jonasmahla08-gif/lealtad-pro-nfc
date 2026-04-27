import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Negocio, Cliente, Transaccion, EstadisticasNegocio } from '@/lib/types'
import { ConfigTabs } from './ConfigTabs'
import { LogoutButtonClient } from '../super-admin/LogoutButtonClient'

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

  const color = negocio.color_principal

  return (
    <div className="min-h-screen" style={{ background: '#f8f7ff' }}>
      {/* Header con gradiente sutil */}
      <header className="sticky top-0 z-10"
              style={{
                background: `linear-gradient(135deg, #1e1b4b 0%, ${color}ee 100%)`,
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {negocio.logo_url ? (
              <img src={negocio.logo_url} alt="Logo"
                   className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg ring-2 ring-white/20"
                   style={{ background: 'rgba(255,255,255,0.15)' }}>
                {negocio.nombre[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-bold text-white leading-none">{negocio.nombre}</h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Panel de administración
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/app"
               className="text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
               style={{
                 background: 'rgba(255,255,255,0.15)',
                 backdropFilter: 'blur(8px)',
                 color: 'white',
                 border: '1px solid rgba(255,255,255,0.2)',
               }}>
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
