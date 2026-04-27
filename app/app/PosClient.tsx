'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { notifyCustomer } from '@/lib/notify'
import { NumericKeypad } from './NumericKeypad'
import { PinModal } from './PinModal'
import type { Negocio, ClientePublico, TransaccionResult } from '@/lib/types'

// ================================================================
// PosClient — Máquina de estados del Punto de Venta
// ================================================================
//
// ESTADOS DEL POS (PosStep):
//   'idle'            → Pantalla inicial. Selección de modo de lectura.
//   'scanning'        → Buscando cliente (NFC móvil, USB o teléfono).
//   'cliente_cargado' → Cliente identificado. Teclado + Cobrar/Recargar.
//   'pin_modal'       → Overlay de PIN (solo para cobros).
//   'procesando'      → RPC en ejecución. Todo deshabilitado.
//
// MODOS DE LECTURA (SearchMode):
//   'nfc'   → Web NFC API (Chrome Android). Lee el chip directamente.
//   'usb'   → Lector USB en modo keyboard emulation (computadora).
//             El lector "escribe" el UID como teclado + Enter.
//             Un input oculto siempre enfocado captura los keystrokes.
//             Detección: Enter del lector O debounce de 150ms sin input.
//             El UID se normaliza (minúsculas, sin separadores) antes
//             de consultar la BD.
//   'phone' → Búsqueda manual por número de teléfono (fallback universal).
//
// ANTI DOBLE CLIC:
//   - `disabled` en botones durante loading (capa 1, visual).
//   - `useRef(isSubmitting)` como capa 2 sin re-render extra.
//
// TEMA DINÁMICO:
//   color_principal del negocio se aplica a header, botones y acentos.
// ================================================================

type PosStep     = 'idle' | 'scanning' | 'cliente_cargado' | 'pin_modal' | 'procesando'
type SearchMode  = 'nfc' | 'usb' | 'phone'

interface PosClientProps { negocio: Negocio }

export function PosClient({ negocio }: PosClientProps) {
  const supabase = createClient()
  const color    = negocio.color_principal

  // ── Estado principal ────────────────────────────────────────
  const [step, setStep]           = useState<PosStep>('idle')
  const [cliente, setCliente]     = useState<ClientePublico | null>(null)
  const [amountCents, setAmount]  = useState(0)
  const [phoneInput, setPhone]    = useState('')
  const [searchMode, setMode]     = useState<SearchMode>('usb')
  const [pinError, setPinError]   = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  // ── Refs ────────────────────────────────────────────────────
  const isSubmitting  = useRef(false)
  const nfcAbortRef   = useRef<AbortController | null>(null)
  // Input oculto para modo USB — captura el UID que "escribe" el lector
  const usbInputRef   = useRef<HTMLInputElement>(null)
  // Timer de debounce para detectar fin de transmisión del lector USB
  const usbDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-enfocar el input USB al activar el modo ────────────
  useEffect(() => {
    if (searchMode === 'usb' && step === 'idle') {
      // Pequeño delay para que el DOM monte el input antes de enfocarlo
      const t = setTimeout(() => usbInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [searchMode, step])

  // ── Resetear a pantalla inicial ─────────────────────────────
  const resetPos = useCallback(() => {
    nfcAbortRef.current?.abort()
    if (usbDebounce.current) clearTimeout(usbDebounce.current)
    setStep('idle')
    setCliente(null)
    setAmount(0)
    setPhone('')
    setPinError('')
    setPinLoading(false)
    isSubmitting.current = false
    // Re-enfocar el input USB tras resetear
    setTimeout(() => usbInputRef.current?.focus(), 100)
  }, [])

  // ── Cargar cliente en el POS ────────────────────────────────
  const cargarCliente = useCallback((c: ClientePublico) => {
    setCliente(c)
    setAmount(0)
    setStep('cliente_cargado')
  }, [])

  // ── Consultar cliente por nfc_id (compartido entre modos NFC y USB) ─
  const buscarPorNfcId = useCallback(async (rawUid: string) => {
    // Normalizar UID: minúsculas, sin separadores (: - espacios)
    // Los lectores USB pueden emitir "04:A3:B2:C1" o "04A3B2C1" o "04a3b2c1"
    const nfcId = rawUid.trim().replace(/[:\-\s]/g, '').toLowerCase()

    if (nfcId.length < 4) return // UID demasiado corto, ignorar

    setStep('scanning')

    const { data, error } = await supabase.rpc('buscar_cliente_por_nfc', {
      p_nfc_id:     nfcId,
      p_negocio_id: negocio.id,
    })

    if (error || !data?.ok) {
      toast.error(data?.error ?? 'Tarjeta no reconocida')
      setStep('idle')
      setTimeout(() => usbInputRef.current?.focus(), 100)
      return
    }

    cargarCliente(data as ClientePublico)
    toast.success(`¡Hola, ${data.nombre}! Saldo: ${formatMXN(data.saldo)}`)
  }, [supabase, negocio.id, cargarCliente])

  // ================================================================
  // MODO USB — keyboard emulation
  // ================================================================
  // Cómo funciona el lector USB en modo teclado:
  //   1. Acercas la tarjeta al lector (sin tocar nada en pantalla).
  //   2. El lector emite el UID carácter por carácter muy rápido (~10ms total).
  //   3. La mayoría emite un Enter al final (lo detectamos con onKeyDown).
  //   4. Si el lector NO emite Enter, el debounce de 150ms lo detecta igual.
  //   5. El input siempre está enfocado; si el cajero hace clic en otra parte,
  //      un evento 'blur' lo re-enfoca automáticamente.
  // ================================================================

  function handleUsbKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (usbDebounce.current) clearTimeout(usbDebounce.current)
      const uid = (e.target as HTMLInputElement).value
      ;(e.target as HTMLInputElement).value = '' // limpiar para próxima lectura
      buscarPorNfcId(uid)
    }
  }

  function handleUsbInput(e: React.ChangeEvent<HTMLInputElement>) {
    // El lector termina en ~50ms. Esperamos 150ms sin input nuevo para confirmar.
    if (usbDebounce.current) clearTimeout(usbDebounce.current)
    const currentValue = e.target.value

    usbDebounce.current = setTimeout(() => {
      if (currentValue.trim().length >= 4) {
        e.target.value = '' // limpiar para próxima lectura
        buscarPorNfcId(currentValue)
      }
    }, 150)
  }

  function handleUsbBlur() {
    // Re-enfocar si el cajero hace clic en otra parte de la pantalla
    // Solo en modo USB e idle/cliente_cargado (no interrumpir otras interacciones)
    if (searchMode === 'usb' && (step === 'idle' || step === 'cliente_cargado')) {
      setTimeout(() => usbInputRef.current?.focus(), 50)
    }
  }

  // ================================================================
  // MODO NFC MÓVIL — Web NFC API
  // ================================================================
  async function handleScanNfc() {
    if (!('NDEFReader' in window)) {
      setMode('usb')
      toast.info('Este dispositivo no tiene NFC integrado. Usa el modo USB o Teléfono.')
      return
    }

    setStep('scanning')
    const abort = new AbortController()
    nfcAbortRef.current = abort

    try {
      const ndef = new NDEFReader()
      await ndef.scan({ signal: abort.signal })

      ndef.addEventListener('reading', async ({ serialNumber }: NDEFReadingEvent) => {
        abort.abort()
        await buscarPorNfcId(serialNumber)
      })

      ndef.addEventListener('readingerror', () => {
        toast.error('Error al leer la tarjeta. Intenta de nuevo.')
        setStep('idle')
      })

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.error(err instanceof Error ? err.message : 'Error NFC')
      setStep('idle')
    }
  }

  // ================================================================
  // MODO TELÉFONO — búsqueda manual por número
  // ================================================================
  async function handlePhoneSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneInput.trim()) return

    setStep('scanning')
    const { data: c, error } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, saldo, nfc_id')
      .eq('telefono', phoneInput.trim())
      .eq('negocio_id', negocio.id)
      .eq('activo', true)
      .single()

    if (error || !c) {
      toast.error('No se encontró un cliente con ese teléfono')
      setStep('idle')
      return
    }

    cargarCliente({ ok: true, ...c })
    toast.success(`¡Hola, ${c.nombre}! Saldo: ${formatMXN(c.saldo)}`)
  }

  // ================================================================
  // COBRO — abre modal de PIN
  // ================================================================
  function handleCobrar() {
    if (amountCents === 0) { toast.warning('Ingresa un monto mayor a $0'); return }
    setPinError('')
    setStep('pin_modal')
  }

  // ================================================================
  // CONFIRMAR COBRO — ejecuta RPC con PIN
  // ================================================================
  async function handlePinConfirm(pin: string) {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setPinLoading(true)
    setPinError('')

    const { data, error } = await supabase.rpc('realizar_transaccion', {
      p_cliente_id: cliente!.id,
      p_tipo:       'cobro',
      p_monto:      amountCents / 100,
      p_pin:        pin,
    })

    const result = data as TransaccionResult | null

    if (error || !result?.ok) {
      setPinError(result?.error ?? error?.message ?? 'Error al procesar')
      setPinLoading(false)
      isSubmitting.current = false
      playBeep('error')
      return
    }

    toast.success(`✅ Cobro exitoso — Nuevo saldo: ${formatMXN(result.nuevo_saldo ?? 0)}`, { duration: 5000 })
    playBeep('success')
    await notifyCustomer(result)
    resetPos()
  }

  // ================================================================
  // RECARGA — sin PIN
  // ================================================================
  async function handleRecargar() {
    if (isSubmitting.current) return
    if (amountCents === 0) { toast.warning('Ingresa un monto mayor a $0'); return }

    isSubmitting.current = true
    setStep('procesando')

    const { data, error } = await supabase.rpc('realizar_transaccion', {
      p_cliente_id: cliente!.id,
      p_tipo:       'recarga',
      p_monto:      amountCents / 100,
      p_pin:        '',
    })

    const result = data as TransaccionResult | null

    if (error || !result?.ok) {
      toast.error(result?.error ?? error?.message ?? 'Error al recargar')
      setStep('cliente_cargado')
      isSubmitting.current = false
      return
    }

    toast.success(`✅ Recarga exitosa — Nuevo saldo: ${formatMXN(result.nuevo_saldo ?? 0)}`, { duration: 5000 })
    playBeep('success')
    await notifyCustomer(result)
    resetPos()
  }

  // ── Handlers teclado numérico ───────────────────────────────
  const handleDigit     = useCallback((d: number) =>
    setAmount(prev => { const n = prev * 10 + d; return n > 999999 ? prev : n }), [])
  const handleBackspace = useCallback(() => setAmount(prev => Math.floor(prev / 10)), [])
  const handleClear     = useCallback(() => setAmount(0), [])

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f7ff' }}>

      {/* Input invisible para modo USB — SIEMPRE en el DOM para no perder el foco */}
      {/* opacity-0 + pointer-events-none: invisible pero funcional para el lector */}
      <input
        ref={usbInputRef}
        aria-hidden="true"
        tabIndex={searchMode === 'usb' ? 0 : -1}
        onKeyDown={handleUsbKeyDown}
        onChange={handleUsbInput}
        onBlur={handleUsbBlur}
        className="fixed -top-10 left-0 w-1 h-1 opacity-0 pointer-events-none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {/* Header */}
      <header className="text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10"
              style={{
                background: `linear-gradient(135deg, #1e1b4b 0%, ${color} 100%)`,
                boxShadow: `0 4px 20px ${color}50`,
              }}>
        <div>
          <p className="font-bold text-lg leading-none tracking-tight">{negocio.nombre}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Punto de Venta</p>
        </div>
        <button onClick={resetPos}
          className="text-xs font-semibold px-4 py-2 rounded-xl transition active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
          }}>
          {cliente ? '✕ Cancelar' : '⟳ Inicio'}
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full">

        {/* ── STEP: idle ─────────────────────────────────────── */}
        {step === 'idle' && (
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="text-center py-2">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl"
                   style={{ background: `linear-gradient(135deg, #1e1b4b, ${color})`,
                            boxShadow: `0 8px 32px ${color}40` }}>
                💳
              </div>
              <h2 className="text-xl font-bold text-gray-900">Identificar cliente</h2>
              <p className="text-sm text-gray-400 mt-1">Selecciona el método de lectura</p>
            </div>

            {/* Toggle de 3 modos */}
            <div className="flex rounded-2xl p-1 gap-1"
                 style={{ background: '#f1f5f9' }}>
              {([
                { id: 'usb'   as SearchMode, label: '🖥️ USB'      },
                { id: 'nfc'   as SearchMode, label: '📡 NFC'      },
                { id: 'phone' as SearchMode, label: '📞 Teléfono' },
              ]).map(({ id, label }) => (
                <button key={id} onClick={() => setMode(id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={searchMode === id ? {
                    background: `linear-gradient(135deg, #1e1b4b, ${color})`,
                    color: 'white',
                    boxShadow: `0 4px 12px ${color}40`,
                  } : { color: '#94a3b8' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Modo USB ──────────────────────────────────────── */}
            {searchMode === 'usb' && (
              <div
                onClick={() => usbInputRef.current?.focus()}
                className="flex flex-col items-center gap-4 py-10 rounded-3xl cursor-pointer transition-all"
                style={{
                  background: `linear-gradient(135deg, ${color}10, ${color}06)`,
                  border: `2px dashed ${color}40`,
                }}
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl bg-white"
                       style={{ boxShadow: `0 8px 24px ${color}30` }}>
                    🖥️
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: color }} />
                    <span className="relative rounded-full h-4 w-4"
                          style={{ backgroundColor: color }} />
                  </span>
                </div>

                <div className="text-center px-4">
                  <p className="font-bold text-gray-900 text-base">Lector USB activo</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Acerca la tarjeta al lector conectado por USB
                  </p>
                  <p className="text-xs mt-3 font-mono px-4 py-1.5 rounded-full inline-block"
                     style={{ background: `${color}15`, color }}>
                    Esperando lectura…
                  </p>
                </div>
                <p className="text-xs text-gray-400 text-center px-6">
                  Si el lector no responde, haz clic aquí para re-enfocar
                </p>
              </div>
            )}

            {/* ── Modo NFC móvil ────────────────────────────────── */}
            {searchMode === 'nfc' && (
              <button onClick={handleScanNfc}
                className="min-h-[100px] w-full rounded-3xl text-white font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                style={{
                  background: `linear-gradient(135deg, #1e1b4b, ${color})`,
                  boxShadow: `0 8px 32px ${color}50`,
                }}>
                <span className="text-3xl">📡</span>
                Escanear Tarjeta NFC
              </button>
            )}

            {/* ── Modo teléfono ─────────────────────────────────── */}
            {searchMode === 'phone' && (
              <form onSubmit={handlePhoneSearch} className="flex flex-col gap-3">
                <input
                  type="tel"
                  placeholder="Número de teléfono del cliente"
                  value={phoneInput}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-4 rounded-2xl text-lg text-center outline-none transition-all"
                  style={{
                    background: '#f8fafc',
                    border: '2px solid #e2e8f0',
                  }}
                  onFocus={e => e.target.style.borderColor = color}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="submit"
                  className="min-h-[56px] w-full rounded-2xl text-white font-bold text-base active:scale-95 transition-all"
                  style={{
                    background: `linear-gradient(135deg, #1e1b4b, ${color})`,
                    boxShadow: `0 4px 20px ${color}40`,
                  }}>
                  🔍 Buscar cliente
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── STEP: scanning ────────────────────────────────────── */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-dashed animate-spin"
                   style={{ borderColor: color }} />
              <span className="absolute inset-0 flex items-center justify-center text-4xl">
                {searchMode === 'usb' ? '🖥️' : searchMode === 'nfc' ? '📡' : '🔍'}
              </span>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {searchMode === 'usb'   ? 'Leyendo tarjeta USB…'
               : searchMode === 'nfc'   ? 'Acerca la tarjeta…'
               :                          'Buscando cliente…'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Por favor espera</p>
            </div>
            <button onClick={resetPos} className="text-sm text-gray-500 underline">
              Cancelar
            </button>
          </div>
        )}

        {/* ── STEP: cliente_cargado / procesando / pin_modal ────── */}
        {(step === 'cliente_cargado' || step === 'procesando' || step === 'pin_modal') && cliente && (
          <>
            {/* Tarjeta del cliente */}
            <div className="rounded-3xl p-5 text-white relative overflow-hidden"
                 style={{
                   background: `linear-gradient(135deg, #1e1b4b 0%, ${color} 100%)`,
                   boxShadow: `0 8px 32px ${color}50`,
                 }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                   style={{ background: 'radial-gradient(circle, white, transparent)',
                            transform: 'translate(30%, -30%)' }} />
              <div className="flex items-center gap-4 relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                  {cliente.nombre?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg truncate">{cliente.nombre}</p>
                  {cliente.telefono && (
                    <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {cliente.telefono}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Saldo</p>
                  <p className="text-2xl font-black text-white">
                    {formatMXN(cliente.saldo ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <NumericKeypad
              amountCents={amountCents}
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onClear={handleClear}
              color={color}
            />

            <div className="grid grid-cols-2 gap-3 pb-4">
              <ActionButton label="💸 Cobrar"   onClick={handleCobrar}   disabled={step === 'procesando' || amountCents === 0}
                style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                         boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }} className="text-white" />
              <ActionButton label="⚡ Recargar" onClick={handleRecargar} disabled={step === 'procesando' || amountCents === 0}
                style={{ background: `linear-gradient(135deg, #1e1b4b, ${color})`,
                         boxShadow: `0 4px 16px ${color}50` }} className="text-white" />
            </div>
          </>
        )}
      </main>

      {/* Modal de PIN */}
      {step === 'pin_modal' && (
        <PinModal
          color={color}
          onConfirm={handlePinConfirm}
          onCancel={() => { setPinError(''); setStep('cliente_cargado') }}
          loading={pinLoading}
          error={pinError}
        />
      )}
    </div>
  )
}

// ── Botón de acción grande ──────────────────────────────────────
function ActionButton({ label, onClick, disabled, className = '', style }: {
  label: string; onClick: () => void; disabled: boolean
  className?: string; style?: React.CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}
      className={`min-h-[64px] rounded-2xl font-bold text-base active:scale-95
                  transition-all duration-75 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}>
      {label}
    </button>
  )
}

// ── Utilidades ──────────────────────────────────────────────────
function formatMXN(amount: number) {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
}

function playBeep(type: 'success' | 'error') {
  if (typeof window === 'undefined' || !window.AudioContext) return
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = type === 'success' ? 880 : 220
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
  } catch { /* ignorar si AudioContext está bloqueado */ }
}
