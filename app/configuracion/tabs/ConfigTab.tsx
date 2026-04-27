'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Negocio } from '@/lib/types'
import { actualizarNegocio } from '../actions'

interface Props { negocio: Negocio }

// ================================================================
// ConfigTab — Personalización del negocio
// ================================================================
// Tres secciones:
//
// 1. NOMBRE Y COLOR:
//    Input de texto para el nombre visible en el POS.
//    Color picker nativo (<input type="color">) para el color_principal.
//    Vista previa en tiempo real del botón del POS con el color elegido.
//    Llama actualizarNegocio Server Action al guardar.
//
// 2. LOGO:
//    Upload a Supabase Storage (bucket "logos").
//    El upload ocurre en el CLIENTE (browser → Supabase directamente)
//    para evitar pasar binarios por el servidor de Next.js.
//    Tras el upload, se obtiene la URL pública y se llama
//    actualizarNegocio con logo_url para persistirla en la tabla.
//
//    Política de Storage necesaria en Supabase:
//      Bucket: logos (público)
//      INSERT: authenticated
//      Path: {negocio_id}/logo.*
//
// 3. INFORMACIÓN DEL SISTEMA:
//    Slug, ID del negocio (para referencia técnica), fecha de creación.
// ================================================================
export function ConfigTab({ negocio }: Props) {
  const [nombre, setNombre]   = useState(negocio.nombre)
  const [color, setColor]     = useState(negocio.color_principal)
  const [logoUrl, setLogoUrl] = useState(negocio.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const supabase = createClient()

  // ── Guardar nombre y color ────────────────────────────────────
  function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('nombre', nombre)
    fd.set('color_principal', color)
    if (logoUrl) fd.set('logo_url', logoUrl)

    startTransition(async () => {
      try {
        await actualizarNegocio(fd)
        toast.success('Configuración guardada — el POS se actualizará al recargar')
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  // ── Upload de logo a Supabase Storage ────────────────────────
  // Flujo:
  //   1. Usuario selecciona imagen con <input type="file">
  //   2. Se sube al bucket "logos" con ruta {negocio_id}/logo.{ext}
  //   3. Se obtiene la URL pública de Supabase Storage
  //   4. Se llama actualizarNegocio con la nueva logo_url
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo y tamaño (máx 2MB)
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (PNG, JPG, WEBP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo no puede superar 2MB')
      return
    }

    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${negocio.id}/logo.${ext}`

      // Upload directo a Supabase Storage desde el browser
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(path)

      setLogoUrl(publicUrl)

      // Persistir en la tabla negocios
      const fd = new FormData()
      fd.set('logo_url', publicUrl)
      await actualizarNegocio(fd)

      toast.success('Logo actualizado correctamente')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el logo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Nombre y color ────────────────────────────────────── */}
      <form onSubmit={handleSaveConfig}
        className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
        <h3 className="font-semibold text-gray-800">Identidad del negocio</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Nombre del negocio
          </label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Ej: Cafetería El Buen Sabor"
          />
        </div>

        {/* Color picker con preview en tiempo real */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Color principal del tema
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-14 h-14 rounded-xl border border-gray-200 cursor-pointer p-1"
            />
            <div className="flex-1">
              <input
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none"
                placeholder="#4f46e5"
              />
              {/* Preview del botón del POS con el color seleccionado */}
              <div className="mt-2 px-4 py-2 rounded-xl text-white text-sm font-semibold text-center transition-colors"
                   style={{ backgroundColor: color }}>
                Vista previa del botón
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={isPending}
          className="w-full h-12 rounded-xl text-white font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: color }}>
          {isPending ? <><Spinner /> Guardando…</> : '💾 Guardar cambios'}
        </button>
      </form>

      {/* ── Logo del negocio ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Logo del negocio</h3>

        <div className="flex items-center gap-5">
          {/* Preview del logo actual */}
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{ borderColor: color + '60' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">🏪</span>
            )}
          </div>

          <div className="flex-1">
            <label className="block">
              <span className="sr-only">Subir logo</span>
              <div className="relative">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-center text-sm text-gray-500 hover:border-indigo-300 transition cursor-pointer">
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner /> Subiendo…
                    </span>
                  ) : (
                    '📁 Seleccionar imagen (PNG, JPG, máx 2MB)'
                  )}
                </div>
              </div>
            </label>
            {logoUrl && (
              <button
                onClick={async () => {
                  const fd = new FormData()
                  fd.set('logo_url', '')
                  await actualizarNegocio(fd)
                  setLogoUrl('')
                  toast.success('Logo eliminado')
                }}
                className="mt-2 text-xs text-red-500 hover:underline"
              >
                Eliminar logo
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400">
          ⚠️ Requiere crear el bucket <code className="bg-gray-100 px-1 rounded">logos</code> en
          Supabase → Storage → New bucket (público) antes de subir.
        </p>
      </div>

      {/* ── Información del sistema ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Información del sistema</h3>
        <InfoRow label="Slug (URL)"        value={`/${negocio.slug}`}     mono />
        <InfoRow label="ID del negocio"    value={negocio.id}             mono copy />
        <InfoRow label="Estado"            value={negocio.activo ? 'Activo ✅' : 'Suspendido ❌'} />
        <InfoRow label="Fecha de creación" value={new Date(negocio.creado_en).toLocaleDateString('es-MX')} />
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────
function InfoRow({ label, value, mono, copy }: {
  label: string; value: string; mono?: boolean; copy?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
        {copy && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado') }}
            className="text-gray-400 hover:text-gray-600 text-xs"
            title="Copiar"
          >
            📋
          </button>
        )}
      </div>
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
