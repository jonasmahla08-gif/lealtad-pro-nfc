'use client'

// ================================================================
// NumericKeypad — Teclado numérico gigante táctil
// ================================================================
// Diseñado específicamente para pantallas móviles en modo retrato.
// Cada botón tiene min-h-[72px] para cumplir con el estándar WCAG
// de área interactiva mínima (48px) con margen para uso con guantes
// o uñas largas en entornos de trabajo.
//
// Lógica de entrada (estilo cajero):
//   - Los dígitos se acumulan en CENTAVOS para evitar aritmética flotante.
//   - Ejemplo: pulsar 1 → 5 → 0 → 0 da "15.00" (centavos: 1500)
//   - Máximo $9,999.99 (centavos: 999999) para evitar errores de rango.
//   - C (Clear): resetea a 0
//   - ⌫ (Backspace): elimina el último dígito (divide entre 10)
//
// Props:
//   amountCents  — valor actual en centavos (estado en PosClient)
//   onDigit      — callback al presionar un número
//   onBackspace  — callback al presionar ⌫
//   onClear      — callback al presionar C
//   color        — color_principal del negocio para botones de acción
// ================================================================

interface NumericKeypadProps {
  amountCents: number
  onDigit: (d: number) => void
  onBackspace: () => void
  onClear: () => void
  color: string
}

export function NumericKeypad({
  amountCents, onDigit, onBackspace, onClear, color,
}: NumericKeypadProps) {
  const display = (amountCents / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Display del monto */}
      <div className="bg-gray-50 rounded-2xl px-6 py-5 text-center border border-gray-200">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Monto</p>
        <p
          className="text-5xl font-bold tabular-nums"
          style={{ color: amountCents > 0 ? color : '#9ca3af' }}
        >
          {display}
        </p>
      </div>

      {/* Grid numérico 3x4 */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <DigitButton key={n} label={String(n)} onPress={() => onDigit(n)} />
        ))}

        {/* Fila inferior: C | 0 | ⌫ */}
        <SpecialButton label="C"  onPress={onClear}     className="bg-amber-50 text-amber-700 hover:bg-amber-100" />
        <DigitButton label="0" onPress={() => onDigit(0)} />
        <SpecialButton label="⌫" onPress={onBackspace}  className="bg-gray-100 text-gray-700 hover:bg-gray-200" />
      </div>
    </div>
  )
}

// ── Botón de dígito ─────────────────────────────────────────────
function DigitButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={e => { e.preventDefault(); onPress() }} // previene delay táctil
      className="
        min-h-[72px] rounded-2xl bg-white border border-gray-200
        text-2xl font-semibold text-gray-800
        hover:bg-gray-50 active:scale-95
        transition-all duration-75 select-none
        shadow-sm
      "
    >
      {label}
    </button>
  )
}

// ── Botón especial (C, ⌫) ───────────────────────────────────────
function SpecialButton({
  label, onPress, className,
}: { label: string; onPress: () => void; className: string }) {
  return (
    <button
      type="button"
      onPointerDown={e => { e.preventDefault(); onPress() }}
      className={`
        min-h-[72px] rounded-2xl
        text-2xl font-bold
        active:scale-95 transition-all duration-75 select-none
        ${className}
      `}
    >
      {label}
    </button>
  )
}
