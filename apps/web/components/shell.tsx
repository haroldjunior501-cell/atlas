import type { ReactNode } from 'react'
import Link from 'next/link'
import { osNav, studioNav } from '@/lib/atlas'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand">ATLAS</p>
        <p className="tag">Create. Operate. Delegate.</p>
        <h2>STUDIO</h2>
        {studioNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
        <h2>OS</h2>
        {osNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

export function Screen({
  layer,
  title,
  lead,
  children,
}: {
  layer: string
  title: string
  lead: string
  children?: ReactNode
}) {
  return (
    <Shell>
      <p className="kicker">{layer}</p>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {children}
    </Shell>
  )
}
