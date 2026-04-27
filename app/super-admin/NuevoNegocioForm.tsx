'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { crearNegocio } from './actions'

// Formulario para dar de alta un nuevo tenant desde el Super Admin.
// Al hacer submit llama la Server Action crearNegocio que genera
// el slug automáticamente desde el nombre.
export function NuevoNegocioForm() {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await crearNegocio(fd)
        toast.success('Negocio creado correctamente')
        if (inputRef.current) inputRef.current.value = ''
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error al crear negocio')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        ref={inputRef}
        name="nombre"
        required
        placeholder="Nombre del negocio…"
        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] px-5 bg-indigo-600 hover:bg-indigo-700
                   disabled:opacity-60 text-white text-sm font-semibold
                   rounded-xl transition"
      >
        {isPending ? 'Creando…' : '+ Crear negocio'}
      </button>
    </form>
  )
}
