import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'ATLAS — AI OS for Organizations',
  description: 'Concevez, personnalisez et pilotez une organisation complète d’employés IA.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className={outfit.className}>{children}</body>
    </html>
  )
}
