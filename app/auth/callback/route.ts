import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Esta ruta recibe el "code" de OAuth o de confirmación de email.
// Supabase lo intercambia por una sesión real y establece las cookies.
// Sin esta ruta, los links de confirmación de email no funcionan.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Si algo falla, redirigir al login con mensaje de error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
