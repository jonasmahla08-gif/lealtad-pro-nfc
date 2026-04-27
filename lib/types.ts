// Tipos derivados del schema v2 (proyecto ktppukfiomhduvudiboj)

export type Negocio = {
  id: string
  nombre: string
  slug: string              // identificador URL-friendly: /app/cafe-martin
  color_principal: string   // hex: #4f46e5
  logo_url: string | null
  activo: boolean           // kill-switch — false = app bloqueada
  owner_id: string | null
  creado_en: string
}

export type Cliente = {
  id: string
  negocio_id: string        // FK a negocios.id (era business_id)
  nombre: string
  telefono: string | null
  nfc_id: string | null     // UID físico del chip NFC (era nfc_uid)
  saldo: number             // siempre >= 0 (garantizado por BD)
  activo: boolean
  creado_en: string
}

export type Transaccion = {
  id: string
  negocio_id: string        // FK a negocios.id (era business_id)
  cliente_id: string
  monto: number
  tipo: 'recarga' | 'cobro'
  descripcion: string | null
  saldo_anterior: number
  saldo_posterior: number
  creado_por: string | null
  creado_en: string
}

// Resultado de la RPC realizar_transaccion
export type TransaccionResult = {
  ok: boolean
  tx_id?: string
  nuevo_saldo?: number
  saldo_anterior?: number
  cliente_id?: string
  cliente_nombre?: string
  cliente_tel?: string      // para notifyCustomer (SMS/WhatsApp)
  tipo?: string
  monto?: number
  error?: string
}

// Resultado de la RPC buscar_cliente_por_nfc
export type ClientePublico = {
  ok: boolean
  id?: string
  nombre?: string
  telefono?: string | null
  saldo?: number
  nfc_id?: string
  error?: string
}

// Resultado de la RPC estadisticas_negocio
export type EstadisticasNegocio = {
  ok: boolean
  total_cobros: number
  total_recargas: number
  num_transacciones: number
  num_clientes_activos: number
  por_dia: Array<{
    dia: string
    cobros: number
    recargas: number
    total_ops: number
  }>
  error?: string
}
