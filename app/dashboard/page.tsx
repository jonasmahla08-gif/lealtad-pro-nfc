import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Negocio } from '@/lib/types'
import { LogoutButtonClient } from '../super-admin/LogoutButtonClient'

// ================================================================
// Dashboard del Admin de Negocio — Server Component
// ================================================================
// Muestra el negocio del usuario autenticado.
// Si no tiene negocio creado aún, le invita a crear uno.
// En Fase 4 se expandirá con estadísticas y configuración.
// ================================================================
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si es super admin, lo mandamos a su panel
  if (user.id === process.env.SUPER_ADMIN_ID) {
    redirect('/super-admin')
  }

  // Obtener el negocio del owner (RLS filtra automáticamente por owner_id)
  const { data: negocio } = await supabase
    .from('negocios')
    .select('*')
    .eq('owner_id', user.id)
    .single<Negocio>()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header dinámico con color del negocio */}
      <header
        className="text-white sticky top-0 z-10"
        style={{ backgroundColor: negocio?.color_principal ?? '#4f46e5' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg leading-none">
              {negocio?.nombre ?? 'Mi Negocio'}
            </h1>
            <p className="text-xs opacity-75">Panel de administración</p>
          </div>
          <LogoutButtonClient />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {negocio ? (
          <>
            {/* Estado del negocio */}
            {!negocio.activo && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-red-500 text-xl">⚠️</span>
                <p className="text-red-700 text-sm font-medium">
                  Tu negocio está suspendido. Contacta al administrador del sistema.
                </p>
              </div>
            )}

            {/* Tarjetas de acceso rápido */}
            <div className="grid grid-cols-2 gap-4">
              <NavCard
                href="/app"
                icon="🏪"
                title="Punto de Venta"
                desc="Cobrar y recargar tarjetas"
                color={negocio.color_principal}
              />
              <NavCard
                href="/configuracion"
                icon="⚙️"
                title="Configuración"
                desc="Logo, colores y clientes"
                color={negocio.color_principal}
              />
            </div>

            {/* Info del negocio */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
              <h2 className="font-semibold text-gray-800">Información del negocio</h2>
              <InfoRow label="Nombre"   value={negocio.nombre} />
              <InfoRow label="Slug"     value={`/${negocio.slug}`} mono />
              <InfoRow label="Estado"   value={negocio.activo ? 'Activo ✅' : 'Suspendido ❌'} />
              <InfoRow
                label="Color tema"
                value={negocio.color_principal}
                badge={negocio.color_principal}
              />
            </section>
          </>
        ) : (
          /* Sin negocio — flujo de onboarding (Fase 4) */
          <div className="bg-white rounded-2xl border border-dashed border-indigo-300 p-10 text-center">
            <p className="text-4xl mb-4">🏪</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Crea tu negocio</h2>
            <p className="text-gray-500 text-sm mb-6">
              Aún no tienes un negocio registrado. Configura uno para comenzar a usar el POS.
            </p>
            <a
              href="/configuracion/nuevo"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition"
            >
              Crear mi negocio
            </a>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────

function NavCard({
  href, icon, title, desc, color,
}: { href: string; icon: string; title: string; desc: string; color: string }) {
  return (
    <a
      href={href}
      className="bg-white rounded-2xl border border-gray-200 p-5
                 hover:shadow-md transition flex flex-col gap-2 min-h-[120px]"
    >
      <span className="text-3xl">{icon}</span>
      <p className="font-semibold text-gray-900 text-sm leading-tight">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
      <div className="mt-auto w-6 h-1 rounded-full" style={{ backgroundColor: color }} />
    </a>
  )
}

function InfoRow({
  label, value, mono, badge,
}: { label: string; value: string; mono?: boolean; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        {badge && (
          <div className="w-4 h-4 rounded-full border border-white shadow"
               style={{ backgroundColor: badge }} />
        )}
        <span className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  )
}
