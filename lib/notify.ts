import type { TransaccionResult } from './types'

// ================================================================
// notifyCustomer — Notificación post-transacción
// ================================================================
// Esta función se ejecuta DESPUÉS de una transacción exitosa.
// Por ahora simula el envío con console.log.
//
// Para integrar con un proveedor real, reemplaza el console.log con:
//   - Twilio SMS:          fetch('https://api.twilio.com/...', { body })
//   - WhatsApp Business:   fetch('https://graph.facebook.com/...', { body })
//   - Webhook propio:      fetch(process.env.NOTIFY_WEBHOOK_URL, { body })
//
// El webhook debe recibir: { telefono, mensaje, negocio, tipo, monto, saldo }
// ================================================================
export async function notifyCustomer(result: TransaccionResult): Promise<void> {
  if (!result.ok || !result.cliente_tel) return

  const esRecarga = result.tipo === 'recarga'
  const monto     = result.monto?.toFixed(2)     ?? '0.00'
  const saldo     = result.nuevo_saldo?.toFixed(2) ?? '0.00'
  const nombre    = result.cliente_nombre ?? 'Cliente'

  const mensaje = esRecarga
    ? `✅ Hola ${nombre}! Se recargaron $${monto} a tu tarjeta. Saldo disponible: $${saldo}. ¡Gracias!`
    : `✅ Hola ${nombre}! Se cobró $${monto} de tu tarjeta. Saldo restante: $${saldo}. ¡Hasta pronto!`

  // ── Simulación de envío ───────────────────────────────────────
  console.log('[notifyCustomer] Enviando notificación:')
  console.log(`  → Teléfono : ${result.cliente_tel}`)
  console.log(`  → Mensaje  : ${mensaje}`)
  console.log(`  → TX ID    : ${result.tx_id}`)

  // ── Webhook preparado (descomentar cuando tengas proveedor) ───
  // await fetch(process.env.NOTIFY_WEBHOOK_URL!, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     telefono: result.cliente_tel,
  //     mensaje,
  //     tx_id: result.tx_id,
  //     tipo: result.tipo,
  //     monto: result.monto,
  //     saldo_nuevo: result.nuevo_saldo,
  //   }),
  // })
}
