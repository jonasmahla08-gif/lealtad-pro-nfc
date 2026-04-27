import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Negocio } from '@/lib/types'
import { PosClient } from './PosClient'

// ================================================================
// /app — Pantalla del Cajero (Server Component wrapper)
// ================================================================
// Este Server Component hace 3 cosas antes de mostrar la UI:
//   1. Verifica que el usuario esté autenticado (middleware ya lo hizo,
//      pero se verifica de nuevo por seguridad)
//   2. Carga el negocio del usuario (filtrado por RLS/owner_id)
//   3. Verifica el kill-switch (activo=false → pantalla de bloqueo)
//
// Los datos del negocio se pasan como props al Client Component.
// Esto es importante: el cliente NUNCA hace un segundo fetch para
// obtener el negocio — viene pre-cargado del servidor de forma segura.
// ================================================================
export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: negocio } = await supabase
    .from('negocios')
    .select('*')
    .eq('owner_id', user.id)
    .single<Negocio>()

  if (!negocio) redirect('/dashboard')

  // Kill-switch: si el negocio está suspendido, bloquear el POS
  if (!negocio.activo) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: negocio.color_principal + '15' }}
      >
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Negocio suspendido
        </h1>
        <p className="text-gray-500 max-w-xs">
          <strong>{negocio.nombre}</strong> ha sido suspendido temporalmente.
          Contacta al administrador del sistema para reactivarlo.
        </p>
        <div className="mt-8 px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm font-medium">
          Servicio no disponible
        </div>
      </div>
    )
  }

  return <PosClient negocio={negocio} />
}
