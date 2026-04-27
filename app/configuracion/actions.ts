'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ================================================================
// actualizarNegocio — actualiza nombre, color y/o logo_url
// ================================================================
// Solo el owner puede actualizar su negocio (RLS lo verifica en BD).
// El color_principal se valida como hex antes de guardar para evitar
// que un valor malformado rompa el CSS dinámico del POS.
// ================================================================
export async function actualizarNegocio(formData: FormData) {
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre   = (formData.get('nombre')          as string)?.trim()
  const color    = (formData.get('color_principal')  as string)?.trim()
  const logo_url = (formData.get('logo_url')         as string)?.trim() || null

  // Validar formato hex (#RRGGBB o #RGB)
  if (color && !/^#[0-9a-fA-F]{3,6}$/.test(color)) {
    throw new Error('Color inválido — usa formato hexadecimal (#RRGGBB)')
  }

  const updates: Record<string, unknown> = {}
  if (nombre)   updates.nombre          = nombre
  if (color)    updates.color_principal = color
  if (logo_url !== undefined) updates.logo_url = logo_url

  const { error } = await supabase
    .from('negocios')
    .update(updates)
    .eq('owner_id', user.id)   // RLS ya lo filtra, pero esto es explícito

  if (error) throw new Error(error.message)

  revalidatePath('/configuracion')
  revalidatePath('/dashboard')
  revalidatePath('/app')
}

// ================================================================
// registrarCliente — alta de cliente con PIN hasheado
// ================================================================
// Llama la RPC registrar_cliente que hace el bcrypt en el servidor.
// El PIN nunca se almacena en texto plano — llega a esta action,
// viaja a la RPC vía HTTPS, y ahí se hashea antes de escribirse en BD.
// ================================================================
export async function registrarCliente(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  // Obtener negocio_id del owner
  const { data: negocio } = await supabase
    .from('negocios')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!negocio) throw new Error('No tienes un negocio configurado')

  const nombre   = (formData.get('nombre')   as string).trim()
  const telefono = (formData.get('telefono') as string).trim() || null
  const nfc_id   = (formData.get('nfc_id')   as string).trim() || null
  const pin      = (formData.get('pin')      as string).trim()

  if (!nombre) throw new Error('El nombre es requerido')
  if (!/^\d{4}$/.test(pin)) throw new Error('El PIN debe ser exactamente 4 dígitos')

  const { data, error } = await supabase.rpc('registrar_cliente', {
    p_negocio_id: negocio.id,
    p_nombre:     nombre,
    p_telefono:   telefono,
    p_nfc_id:     nfc_id,
    p_pin:        pin,
  })

  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error al registrar cliente')

  revalidatePath('/configuracion')
}

// ================================================================
// crearPrimerNegocio — onboarding: crea el negocio inicial del owner
// ================================================================
export async function crearPrimerNegocio(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const nombre = (formData.get('nombre') as string).trim()
  if (!nombre) throw new Error('El nombre es requerido')

  const slug = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { error } = await supabase
    .from('negocios')
    .insert({ nombre, slug, activo: true, owner_id: user.id })

  if (error) throw new Error(error.message)
  // Sin redirect aquí — el cliente maneja la navegación
}

// ================================================================
// toggleClienteActivo — activa/desactiva un cliente
// ================================================================
export async function toggleClienteActivo(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const clienteId    = formData.get('cliente_id') as string
  const activoActual = formData.get('activo') === 'true'

  const { error } = await supabase
    .from('clientes')
    .update({ activo: !activoActual })
    .eq('id', clienteId)
  // RLS verifica que el cliente pertenezca al negocio del owner

  if (error) throw new Error(error.message)
  revalidatePath('/configuracion')
}
