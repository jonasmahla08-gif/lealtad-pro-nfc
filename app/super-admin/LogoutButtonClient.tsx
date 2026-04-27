'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Botón de cierre de sesión.
// Llama supabase.auth.signOut() que limpia las cookies de sesión.
// El middleware detecta que no hay sesión y redirige a /login.
export function LogoutButtonClient() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-500 hover:text-red-600 font-medium transition"
    >
      Cerrar sesión
    </button>
  )
}
