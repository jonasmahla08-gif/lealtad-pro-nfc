import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Negocio } from '@/lib/types'
import { ToggleButton } from './ToggleButton'
import { NuevoNegocioForm } from './NuevoNegocioForm'

// ================================================================
// Super Admin Dashboard — Server Component
// ================================================================
// Al ser Server Component:
//   - El fetch de negocios ocurre en el servidor (no hay loading state).
//   - La service_role key NUNCA llega al navegador.
//   - Cada revalidatePath('/super-admin') de las actions recarga
//     este componente con datos frescos de BD.
//
// Acceso: solo el usuario cuyo uid coincide con SUPER_ADMIN_ID en .env
//   (doble verificación: middleware + este componente).
// ================================================================
export default async function SuperAdminPage() {
  // Segunda verificación del rol (defensa en profundidad)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== process.env.SUPER_ADMIN_ID) {
    redirect('/dashboard')
  }

  // Obtener TODOS los negocios con service_role (bypassa RLS)
  const adminClient = createAdminClient()
  const { data: negocios, error } = await adminClient
    .from('negocios')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Error al cargar negocios: {error.message}</p>
      </div>
    )
  }

  const activos    = (negocios ?? []).filter((n: Negocio) => n.activo).length
  const suspendidos = (negocios ?? []).length - activos

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SA</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-none">Super Admin</h1>
              <p className="text-xs text-gray-500">Lealtad Pro NFC</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total negocios" value={(negocios ?? []).length} color="indigo" />
          <StatCard label="Activos"         value={activos}                color="green"  />
          <StatCard label="Suspendidos"     value={suspendidos}            color="red"    />
        </div>

        {/* Formulario nuevo negocio */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Crear nuevo negocio</h2>
          <NuevoNegocioForm />
        </section>

        {/* Lista de negocios */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Todos los negocios</h2>
          </div>

          {(negocios ?? []).length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No hay negocios registrados todavía.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(negocios as Negocio[]).map(negocio => (
                <li key={negocio.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Color del tema */}
                  <div
                    className="w-3 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: negocio.color_principal }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{negocio.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono">/{negocio.slug}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Creado: {new Date(negocio.creado_en).toLocaleDateString('es-MX')}
                    </p>
                  </div>

                  {/* Badge estado */}
                  <span className={`
                    hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                    ${negocio.activo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                    }
                  `}>
                    {negocio.activo ? 'Activo' : 'Suspendido'}
                  </span>

                  {/* Kill-switch: este botón es el corazón del sistema de control */}
                  <ToggleButton
                    negocioId={negocio.id}
                    activo={negocio.activo}
                    nombre={negocio.nombre}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────

function StatCard({
  label, value, color,
}: { label: string; value: number; color: 'indigo' | 'green' | 'red' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green:  'bg-green-50  text-green-700',
    red:    'bg-red-50    text-red-700',
  }
  return (
    <div className={`rounded-2xl p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  )
}

// LogoutButton es Client Component — lo embebemos como inline client component
// para no crear un archivo extra por un botón simple
function LogoutButton() {
  // Como esta función está dentro de un Server Component, no puede ser
  // 'use client' directamente. La exportamos como componente separado abajo.
  return <LogoutButtonClient />
}

// ── Client Component para el botón de logout ───────────────────
// (debe estar en el mismo archivo o importarse; aquí lo dejamos inline
//  marcando el componente como client al inicio del bloque)
import { LogoutButtonClient } from './LogoutButtonClient'
