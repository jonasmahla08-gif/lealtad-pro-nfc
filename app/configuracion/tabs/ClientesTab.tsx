'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import type { Cliente } from '@/lib/types'
import { registrarCliente, toggleClienteActivo } from '../actions'

interface Props {
  clientes: Cliente[]
  color: string
}

// ================================================================
// ClientesTab — Registro y gestión de clientes
// ================================================================
// Dos secciones:
//
// 1. FORMULARIO DE ALTA:
//    Campos: Nombre (req), Teléfono (opcional), NFC ID (opcional),
//            PIN de 4 dígitos (req).
//    El PIN se muestra como dots para evitar shoulder surfing.
//    Llama la Server Action registrarCliente que llama la RPC
//    registrar_cliente — el PIN se hashea en el servidor con bcrypt.
//    Validación doble: cliente (regex) + servidor (RPC).
//
//    Campo NFC ID:
//    - Puede dejarse vacío y configurarse después
//    - Si el admin tiene un lector USB conectado puede acercar
//      la tarjeta aquí directamente (keyboard emulation)
//    - El campo captura el UID y lo normaliza (lowercase, sin ":")
//
// 2. LISTA DE CLIENTES:
//    Tabla con: nombre, teléfono, nfc_id, saldo, estado.
//    Botón para activar/desactivar cada cliente (toggle).
//    Cliente inactivo no puede operar en el POS.
// ================================================================
export function ClientesTab({ clientes, color }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Estado del PIN (4 dígitos, mostrado como dots)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  // Input del NFC ID (puede recibir keyboard emulation del lector USB)
  const nfcInputRef = useRef<HTMLInputElement>(null)
  const nfcDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Captura del UID del lector USB en el campo NFC ID ─────────
  // Cuando el admin registra un cliente, puede acercar la tarjeta
  // al lector USB mientras el cursor está en el campo nfc_id.
  // El lector "escribe" el UID + Enter automáticamente.
  function handleNfcKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (nfcDebounce.current) clearTimeout(nfcDebounce.current)
      // Normalizar y mover foco al siguiente campo
      const input = e.target as HTMLInputElement
      input.value = normalizeUid(input.value)
      // El cajero puede acercar la tarjeta y el foco avanza solo
    }
  }

  function handleNfcChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (nfcDebounce.current) clearTimeout(nfcDebounce.current)
    const val = e.target.value
    nfcDebounce.current = setTimeout(() => {
      if (val.length >= 4) {
        e.target.value = normalizeUid(val)
      }
    }, 150)
  }

  // ── Submit del formulario de alta ─────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pin.length !== 4) { toast.error('El PIN debe ser de 4 dígitos'); return }

    const fd = new FormData(e.currentTarget)
    fd.set('pin', pin)  // PIN construido con el control personalizado

    // Normalizar nfc_id del input
    const nfcVal = (fd.get('nfc_id') as string).trim()
    fd.set('nfc_id', normalizeUid(nfcVal))

    startTransition(async () => {
      try {
        await registrarCliente(fd)
        toast.success('Cliente registrado correctamente')
        formRef.current?.reset()
        setPin('')
        setShowForm(false)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error al registrar')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Botón abrir formulario ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{clientes.length} cliente(s) registrado(s)</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition active:scale-95"
          style={{ backgroundColor: color }}
        >
          {showForm ? '✕ Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>

      {/* ── Formulario de alta ────────────────────────────────── */}
      {showForm && (
        <form ref={formRef} onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Registrar nuevo cliente</h3>

          <Field label="Nombre completo *">
            <input name="nombre" required placeholder="Ej: María López"
              className={inputCls} />
          </Field>

          <Field label="Teléfono (opcional — para notificaciones)">
            <input name="telefono" type="tel" placeholder="Ej: 5512345678"
              className={inputCls} />
          </Field>

          <Field label="ID de tarjeta NFC (opcional — acerca la tarjeta al lector USB)">
            <input
              name="nfc_id"
              ref={nfcInputRef}
              placeholder="Escanea o escribe el UID"
              onKeyDown={handleNfcKeyDown}
              onChange={handleNfcChange}
              className={`${inputCls} font-mono`}
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              Puedes acercar la tarjeta al lector USB con el cursor aquí
            </p>
          </Field>

          {/* ── Control de PIN personalizado ────────────────────── */}
          {/* No usamos <input type="password"> para evitar que el gestor
              de contraseñas lo autocomplete con credenciales guardadas */}
          <Field label="PIN de 4 dígitos *">
            <div className="flex gap-2 items-center">
              <div className="flex gap-3 flex-1">
                {[0,1,2,3].map(i => (
                  <div key={i}
                    className="flex-1 h-12 border-2 rounded-xl flex items-center justify-center text-xl font-bold transition"
                    style={{ borderColor: i < pin.length ? color : '#e5e7eb' }}>
                    {i < pin.length ? (showPin ? pin[i] : '●') : ''}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowPin(v => !v)}
                className="text-gray-400 hover:text-gray-600 text-lg px-2">
                {showPin ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Mini teclado para el PIN */}
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {[1,2,3,4,5,6,7,8,9,0].map(n => (
                <button key={n} type="button"
                  onClick={() => setPin(p => p.length < 4 ? p + n : p)}
                  className="h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold transition active:scale-95">
                  {n}
                </button>
              ))}
              <button type="button" onClick={() => setPin(p => p.slice(0, -1))}
                className="col-span-5 h-9 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition">
                ⌫ Borrar
              </button>
            </div>
          </Field>

          <button type="submit" disabled={isPending || pin.length !== 4}
            className="w-full h-12 rounded-xl text-white font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: color }}>
            {isPending ? <><Spinner /> Registrando…</> : 'Registrar cliente'}
          </button>
        </form>
      )}

      {/* ── Lista de clientes ─────────────────────────────────── */}
      {clientes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">👥</p>
          <p>Aún no hay clientes. Registra el primero.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {clientes.map(c => (
              <ClienteRow key={c.id} cliente={c} color={color} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Fila de cliente ─────────────────────────────────────────────
function ClienteRow({ cliente, color }: { cliente: Cliente; color: string }) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const fd = new FormData()
    fd.set('cliente_id', cliente.id)
    fd.set('activo', String(cliente.activo))

    startTransition(async () => {
      try {
        await toggleClienteActivo(fd)
        toast.success(cliente.activo ? 'Cliente desactivado' : 'Cliente activado')
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <li className={`px-5 py-4 flex items-center gap-3 ${!cliente.activo ? 'opacity-50' : ''}`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
           style={{ backgroundColor: color }}>
        {cliente.nombre[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{cliente.nombre}</p>
        <p className="text-xs text-gray-400 truncate">
          {cliente.telefono ?? '—'} · NFC: {cliente.nfc_id ? `${cliente.nfc_id.slice(0,8)}…` : 'sin tarjeta'}
        </p>
      </div>

      {/* Saldo */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color }}>
          {cliente.saldo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
        </p>
        <p className="text-xs text-gray-400">saldo</p>
      </div>

      {/* Toggle activo */}
      <button onClick={handleToggle} disabled={isPending}
        className={`
          ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50
          ${cliente.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}
        `}>
        {isPending ? '…' : cliente.activo ? 'Desactivar' : 'Activar'}
      </button>
    </li>
  )
}

// ── Helpers ─────────────────────────────────────────────────────
function normalizeUid(raw: string) {
  return raw.trim().replace(/[:\-\s]/g, '').toLowerCase()
}

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
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
