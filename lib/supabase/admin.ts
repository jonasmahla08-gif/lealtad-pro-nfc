import { createClient } from '@supabase/supabase-js'

// Cliente con service_role — bypassa RLS completamente.
// SOLO usar en Server Components / Server Actions / Route Handlers.
// NUNCA importar en archivos con 'use client'.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
