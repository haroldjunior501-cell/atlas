import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg'
import type { UseCaseId } from '../lib/use-cases'
import { colors } from '../lib/theme'

export function UseCaseIcon({ id, size = 22 }: { id: UseCaseId; size?: number }) {
  const stroke = colors.ink
  const common = { stroke, strokeWidth: 1.6, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (id) {
    case 'day':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3.5" y="5" width="17" height="15" rx="2.5" {...common} />
          <Path d="M8 3.5v3M16 3.5v3M3.5 10h17" {...common} />
          <Path d="M9 14.5l2 2 4-4" {...common} />
        </Svg>
      )
    case 'automate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="3.2" {...common} />
          <Path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" {...common} />
        </Svg>
      )
    case 'team':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="9" cy="8.5" r="2.4" {...common} />
          <Circle cx="16.2" cy="9.2" r="2" {...common} />
          <Path d="M4.5 18.5c.6-3 2.6-4.6 4.5-4.6s3.9 1.6 4.5 4.6" {...common} />
          <Path d="M13.2 18.5c.4-2.2 1.8-3.4 3-3.4 1.4 0 2.7 1.1 3.3 3.4" {...common} />
        </Svg>
      )
    case 'project':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 16.5c3.2-1.2 5.4-4.2 7-8.2l1.2-3 3 1.2c4 1.6 7 3.8 8.2 7" {...common} />
          <Path d="M12.2 8.3l3.5 3.5" {...common} />
          <Path d="M5 16.5l2.2 2.2" {...common} />
        </Svg>
      )
    case 'data':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 19V10.5M10.5 19V6M16 19v-7.5M21 19H3" {...common} />
        </Svg>
      )
    case 'learn':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3.5 9.5 12 5l8.5 4.5L12 14 3.5 9.5Z" {...common} />
          <Path d="M7.2 11.5v4.2c0 1.4 2.1 2.8 4.8 2.8s4.8-1.4 4.8-2.8v-4.2" {...common} />
          <Path d="M20.5 9.5v6.2" {...common} />
        </Svg>
      )
    case 'business':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="3.5" y="8" width="17" height="12" rx="2" {...common} />
          <Path d="M9 8V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V8" {...common} />
          <Path d="M3.5 13h17" {...common} />
        </Svg>
      )
    case 'other':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 4.5l1.2 3.6H17l-2.9 2.2 1.1 3.7L12 11.9 8.8 14l1.1-3.7L7 8.1h3.8L12 4.5Z" {...common} />
          <Polyline points="18.5,16 19.2,18 21.2,18.2 19.7,19.6 20.1,21.6 18.5,20.6 16.9,21.6 17.3,19.6 15.8,18.2 17.8,18" {...common} />
        </Svg>
      )
  }
}
