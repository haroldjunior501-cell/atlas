import { Suspense } from 'react'
import { LaunchScreen } from './launch'

export default function LancementPage() {
  return (
    <Suspense>
      <LaunchScreen />
    </Suspense>
  )
}
