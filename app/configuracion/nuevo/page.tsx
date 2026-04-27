'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearPrimerNegocio } from '../actions'

// ================================================================
// /configuracion/nuevo — Onboarding: crear primer negocio
// ================================================================
// Página de alta inicial para owners que acaban de registrarse.
// El dashboard los redirige aquí si no tienen negocio aún.
//
// La Server Action crearPrimerNegocio:
//   1. Genera el slug automáticamente del nombre
//   2. Crea la fila en negocios con owner_id = auth.uid()
//   3. Redirige a /dashboard
// ================================================================
export default function NuevoNegocioPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [color, setColor]   = useState('#4f46e5')
  const [isPending, startTransition] = useTransition()

  // Slug preview en tiempo real
  const slugPreview = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('color_principal', color)

    startTransition(async () => {
      try {
        await crearPrimerNegocio(fd)
        router.push('/dashboard')
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error al crear el negocio')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8">
        <div className="text-center mb-8">
          <span className="text-5xl">🏪</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Crea tu negocio</h1>
          <p className="text-sm text-gray-500 mt-2">
            Configura tu punto de venta en menos de 1 minuto
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Nombre del negocio *
            </label>
            <input
              name="nombre"
              required
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Cafetería El Buen Sabor"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {slugPreview && (
              <p className="text-xs text-gray-400 mt-1 font-mono">
                URL: /app/<strong>{slugPreview}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Color principal del tema
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1 flex-shrink-0"
              />
              <div
                className="flex-1 h-12 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: color }}
              >
                Vista previa
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !nombre.trim()}
            className="w-full h-12 rounded-xl text-white font-semibold transition
                       disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: color }}
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Creando…
              </>
            ) : (
              '🚀 Crear mi negocio'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
