'use client'

import dynamic from 'next/dynamic'

const Bureau = dynamic(() => import('../bureau/bureau').then((mod) => mod.Bureau), {
  ssr: false,
})

/** Atlas hors plateforme — appelé depuis le Companion Windows (Ctrl+Shift+A). */
export default function OverlayPage() {
  return <Bureau overlay />
}
