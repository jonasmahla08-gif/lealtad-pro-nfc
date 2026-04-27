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
    if (loading) return
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      } else {
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
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>

      {/* Orbes decorativos de fondo */}
      <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
      <div className="absolute bottom-[-60px] right-[-60px] w-72 h-72 rounded-full opacity-15 blur-3xl"
           style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full opacity-10 blur-2xl"
           style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

      {/* Tarjeta glassmorphism */}
      <div className="relative w-full max-w-sm rounded-3xl p-8 border border-white/10"
           style={{
             background: 'rgba(255,255,255,0.06)',
             backdropFilter: 'blur(24px)',
             boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
           }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
               style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-3xl">💳</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lealtad Pro NFC</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                   style={{ color: 'rgba(255,255,255,0.5)' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                   style={{ color: 'rgba(255,255,255,0.5)' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none transition"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.8)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold text-white transition-all active:scale-[0.98] mt-2"
            style={{
              background: loading
                ? 'rgba(99,102,241,0.5)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> {mode === 'login' ? 'Entrando…' : 'Registrando…'}
              </span>
            ) : (
              mode === 'login' ? 'Entrar' : 'Crear cuenta'
            )}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'registro' : 'login')}
            className="font-semibold transition hover:opacity-80"
            style={{ color: '#818cf8' }}
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
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
