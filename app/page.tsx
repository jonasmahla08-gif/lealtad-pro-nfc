import { redirect } from 'next/navigation'

// La raíz del dominio redirige al dashboard.
// El middleware intercepta primero: si no hay sesión → /login.
// Si hay sesión → /dashboard → y este la pasa al panel correcto.
export default function RootPage() {
  redirect('/dashboard')
}
