'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { toggleActivo } from './actions'

// ================================================================
// ToggleButton — Botón cliente para Suspender / Activar un negocio
// ================================================================
// ¿Por qué Client Component aquí y no un <form> puro?
//   - useTransition() nos da el estado `isPending` para mostrar
//     un spinner mientras la Server Action procesa la petición.
//   - toast.success/error da feedback inmediato sin recargar la página.
//   - La Server Action sigue corriendo en el servidor; este componente
//     solo maneja la interacción visual.
//
// Botón Suspender (rojo): el negocio quedará con activo=false.
//   → Su cajero (/app) recibe "Negocio suspendido" en cada transacción.
//   → No pueden hacer cobros ni recargas.
// Botón Activar (verde): restaura activo=true inmediatamente.
// ================================================================
interface Props {
  negocioId: string
  activo: boolean
  nombre: string
}

export function ToggleButton({ negocioId, activo, nombre }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('negocio_id', negocioId)
      fd.set('activo', String(activo))

      try {
        await toggleActivo(fd)
        toast.success(
          activo
            ? `"${nombre}" suspendido correctamente`
            : `"${nombre}" activado correctamente`
        )
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Error al cambiar estado')
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`
        min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold
        flex items-center gap-2 transition
        disabled:opacity-60 disabled:cursor-not-allowed
        ${activo
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-green-100 text-green-700 hover:bg-green-200'
        }
      `}
    >
      {isPending ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      ) : (
        <span>{activo ? '🔴' : '🟢'}</span>
      )}
      {activo ? 'Suspender' : 'Activar'}
    </button>
  )
}
