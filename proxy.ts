import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ================================================================
// MIDDLEWARE DE RUTAS — Se ejecuta en CADA request del servidor.
// Orden de evaluación:
//   1. Assets estáticos / auth callback → pasan sin control
//   2. Rutas públicas (/login) → si hay sesión, redirige a /dashboard
//   3. Rutas protegidas sin sesión → redirige a /login
//   4. /super-admin → solo el SUPER_ADMIN_ID configurado en env
// ================================================================
export async function proxy(request: NextRequest) {
  // updateSession refresca el token JWT en cada request para que
  // la sesión no expire silenciosamente mientras el usuario trabaja.
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // ── Rutas completamente públicas ─────────────────────────────
  const esPublica =
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||   // /auth/callback
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/public') ||
    pathname === '/favicon.ico'

  // ── Redirigir usuarios ya autenticados fuera del login ───────
  if (user && pathname === '/login') {
    const dest = user.id === process.env.SUPER_ADMIN_ID
      ? '/super-admin'
      : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── Rutas protegidas sin sesión → forzar login ────────────────
  if (!user && !esPublica) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)   // para volver tras login
    return NextResponse.redirect(loginUrl)
  }

  // ── /super-admin → solo el Super Admin ───────────────────────
  // Compara el uid de la sesión con la variable de entorno SUPER_ADMIN_ID.
  // Si alguien más intenta acceder, va a /dashboard sin mensaje de error
  // (no revelamos que la ruta existe).
  if (pathname.startsWith('/super-admin') && user) {
    if (user.id !== process.env.SUPER_ADMIN_ID) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Todo OK: continuar con la response de Supabase ───────────
  // supabaseResponse lleva las cookies de sesión actualizadas.
  // Es CRÍTICO retornarla (no un NextResponse.next() genérico),
  // o las cookies no se propagan y la sesión se rompe.
  return supabaseResponse
}

export const config = {
  matcher: [
    // Excluir imágenes, fuentes y archivos estáticos de Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
