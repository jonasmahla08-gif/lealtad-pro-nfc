'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState<'login' | 'registro'>('login')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return          // Debounce: ignora doble clic
    setLoading(true)

    try {
      if (mode === 'login') {
        // ── INICIO DE SESIÓN ──────────────────────────────────────────
        // signInWithPassword valida email+contraseña contra Supabase Auth.
        // Si la cuenta no existe o la contraseña es incorrecta, devuelve error.
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // Tras login exitoso el middleware detecta la sesión y permite el acceso.
        // Redirigimos a /dashboard; el middleware redirige a /super-admin
        // si el uid coincide con SUPER_ADMIN_ID.
        router.push('/dashboard')
        router.refresh()         // Fuerza revalidación del Server Component

      } else {
        // ── REGISTRO ─────────────────────────────────────────────────
        // signUp crea la cuenta. Supabase envía un email de confirmación
        // si el proyecto tiene "Confirm email" activado en Auth Settings.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error

        toast.success('¡Revisa tu correo para confirmar la cuenta!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Lealtad Pro NFC</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Botón principal — se deshabilita durante el request (anti doble clic) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner />
                {mode === 'login' ? 'Entrando…' : 'Registrando…'}
              </>
            ) : (
              mode === 'login' ? 'Entrar' : 'Crear cuenta'
            )}
          </button>
        </form>

        {/* Toggle entre login y registro */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'registro' : 'login')}
            className="text-indigo-600 font-medium hover:underline"
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
