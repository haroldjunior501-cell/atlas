'use client'

import { ArchitectureSim } from '@/components/architecture-sim'
import styles from './architecture.module.css'

export default function ArchitecturePage() {
  return (
    <div className={styles.page}>
      <ArchitectureSim journal framed />
    </div>
  )
}
