'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ================================================================
// toggleActivo — Server Action del Super Admin
// ================================================================
// ¿Por qué Server Action y no un Route Handler?
//   - El código corre en el servidor: la service_role key nunca
//     llega al navegador.
//   - revalidatePath() actualiza la lista de negocios sin reload manual.
//   - El formulario HTML funciona aunque JS esté deshabilitado.
//
// Seguridad de doble verificación:
//   1. El middleware ya bloqueó la ruta si no es SUPER_ADMIN_ID.
//   2. Esta action verifica la sesión de nuevo por si acaso (defense in depth).
// ================================================================
export async function toggleActivo(formData: FormData) {
  // 1. Re-verificar sesión y rol desde el servidor
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== process.env.SUPER_ADMIN_ID) {
    throw new Error('No autorizado')
  }

  const negocioId    = formData.get('negocio_id') as string
  const activoActual = formData.get('activo') === 'true'

  // 2. Usar cliente admin (service_role) para saltarse RLS
  //    (el super admin no es owner de ningún negocio, pero debe editarlos todos)
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('negocios')
    .update({ activo: !activoActual })
    .eq('id', negocioId)

  if (error) throw new Error(error.message)

  // 3. Forzar revalidación: el Server Component de la página
  //    volverá a hacer fetch y mostrará el estado actualizado
  revalidatePath('/super-admin')
}

// ================================================================
// crearNegocio — Server Action para dar de alta un nuevo tenant
// ================================================================
export async function crearNegocio(formData: FormData) {
  const supabase    = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== process.env.SUPER_ADMIN_ID) {
    throw new Error('No autorizado')
  }

  const nombre = (formData.get('nombre') as string).trim()
  const slug   = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('negocios')
    .insert({ nombre, slug, activo: true })

  if (error) throw new Error(error.message)

  revalidatePath('/super-admin')
}
