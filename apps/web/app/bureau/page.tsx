'use client'

import dynamic from 'next/dynamic'

const Bureau = dynamic(() => import('./bureau').then((mod) => mod.Bureau), {
  ssr: false,
})

export default function BureauPage() {
  return <Bureau />
}
