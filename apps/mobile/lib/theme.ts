/** Brand ATLAS — aligné sur le logo web (orange → rouge). */
export const colors = {
  bg: '#050508',
  bgDeep: '#0a0612',
  ink: '#ffffff',
  muted: 'rgba(255,255,255,0.72)',
  soft: 'rgba(255,255,255,0.55)',
  link: '#ffb48a',
  brandStart: '#ffc98a',
  brandMid: '#fd8925',
  brandEnd: '#ff1a08',
  brandHot: '#ff0c00',
  glow: 'rgba(253, 137, 37, 0.35)',
} as const

export const brandGradient = [colors.brandMid, colors.brandHot] as const
export const markGradient = [colors.brandStart, colors.brandMid, colors.brandEnd] as const
