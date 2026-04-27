'use client'

import { useState, useCallback } from 'react'

// ================================================================
// PinModal — Modal de verificación de PIN de 4 dígitos
// ================================================================
// Se activa EXCLUSIVAMENTE antes de ejecutar un COBRO.
// Las recargas no requieren PIN (solo el cajero las autoriza).
//
// Seguridad del flujo de PIN:
//   1. El PIN se ingresa en este modal en el dispositivo del cajero.
//   2. Se envía como texto plano vía HTTPS a la RPC de Supabase.
//   3. La RPC usa crypt(p_pin, pin_hash) para comparar con bcrypt.
//   4. El PIN nunca se almacena en el estado de React más de lo necesario.
//   5. En caso de PIN incorrecto, el campo se limpia y muestra el error.
//
// UX del teclado de PIN:
//   - 4 círculos indicadores (● relleno = ingresado, ○ = vacío)
//   - Teclado numérico 3x4 bajo los indicadores
//   - Al completar 4 dígitos se habilita el botón "Confirmar"
//   - onPointerDown en lugar de onClick para eliminar el delay de 300ms en iOS
//
// Props:
//   color      — color del negocio para el botón confirmar
//   onConfirm  — callback con el PIN ingresado (lo ejecuta PosClient)
//   onCancel   — cierra el modal sin ejecutar nada
//   loading    — mientras la RPC procesa, deshabilita todo el modal
//   error      — mensaje de error del servidor (PIN incorrecto, etc.)
// ================================================================

interface PinModalProps {
  color: string
  onConfirm: (pin: string) => void
  onCancel: () => void
  loading: boolean
  error: string
}

export function PinModal({ color, onConfirm, onCancel, loading, error }: PinModalProps) {
  const [pin, setPin] = useState('')

  const handleDigit = useCallback((d: number) => {
    setPin(prev => {
      if (prev.length >= 4 || loading) return prev
      return prev + String(d)
    })
  }, [loading])

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
  }, [])

  const handleConfirm = useCallback(() => {
    if (pin.length === 4 && !loading) {
      onConfirm(pin)
    }
  }, [pin, loading, onConfirm])

  return (
    // Overlay oscuro — toca fuera para cancelar
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 space-y-6 shadow-2xl">
        {/* Encabezado */}
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Verificar PIN</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pide al cliente su PIN de 4 dígitos
          </p>
        </div>

        {/* Indicadores de dígitos (●/○) */}
        <div className="flex justify-center gap-5">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`
                w-5 h-5 rounded-full border-2 transition-all duration-150
                ${i < pin.length
                  ? 'bg-indigo-600 border-indigo-600 scale-110'
                  : 'bg-white border-gray-300'
                }
              `}
              style={i < pin.length ? { backgroundColor: color, borderColor: color } : {}}
            />
          ))}
        </div>

        {/* Mensaje de error (PIN incorrecto) */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Teclado numérico del PIN */}
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <PinKey
              key={n}
              label={String(n)}
              onPress={() => handleDigit(n)}
              disabled={loading}
            />
          ))}
          <div /> {/* celda vacía */}
          <PinKey label="0" onPress={() => handleDigit(0)} disabled={loading} />
          <PinKey
            label="⌫"
            onPress={handleBackspace}
            disabled={loading}
            className="text-gray-500 bg-gray-50"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600
                       font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={pin.length !== 4 || loading}
            className="flex-1 h-12 rounded-xl text-white font-semibold text-sm
                       transition flex items-center justify-center gap-2
                       disabled:opacity-40"
            style={{
              backgroundColor: pin.length === 4 && !loading ? color : '#9ca3af',
            }}
          >
            {loading ? (
              <>
                <Spinner />
                Verificando…
              </>
            ) : (
              'Confirmar cobro'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tecla del PIN ───────────────────────────────────────────────
function PinKey({
  label, onPress, disabled, className = '',
}: {
  label: string
  onPress: () => void
  disabled: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onPointerDown={e => { e.preventDefault(); onPress() }}
      disabled={disabled}
      className={`
        h-14 rounded-xl text-xl font-semibold text-gray-800
        bg-gray-100 hover:bg-gray-200 active:scale-95
        transition-all duration-75 select-none
        disabled:opacity-50 ${className}
      `}
    >
      {label}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}
