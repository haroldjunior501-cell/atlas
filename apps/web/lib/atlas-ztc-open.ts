import { ZTC_CLIENT_AREA, ZTC_DEVOID_API, ZTC_NAME, ZTC_SITE, ZTC_STORE } from '@atlas/domain'

export type ZtcOpenTarget = { url: string; label: string }

/** « Ouvre le site ZtcHosting / la boutique / l’espace client » → URL réelle. */
export function interpretZtcSiteOpen(raw: string): ZtcOpenTarget | null {
  const heard = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const wantsOpen = /(ouvre|ouvrir|lance|affiche|montre|va sur|aller sur|ouvre[- ]moi|montre[- ]moi)/.test(heard)
  if (!wantsOpen) return null

  const aboutOrg = /(ztc|ztchosting|hosting|organisation|mon site|notre site|le site|site web|page web|boutique|espace client|devoid)/.test(heard)
  if (!aboutOrg && !/https?:\/\/ztchosting\.com/.test(heard)) return null

  // Ne pas confondre avec le Bureau 3D du Studio
  if (/bureau\s*3d|jumeau|plein\s*ecran|organigramme/.test(heard) && !/site|ztchosting|boutique|http/.test(heard)) {
    return null
  }

  if (/boutique|\/order|commander|store|shop|tarif|prix|sku/.test(heard)) {
    return { url: ZTC_STORE, label: `la boutique ${ZTC_NAME}` }
  }
  if (/espace client|client area|\/login|connexion client|se connecter/.test(heard)) {
    return { url: ZTC_CLIENT_AREA, label: `l’espace client ${ZTC_NAME}` }
  }
  if (/devoid/.test(heard) && /api|endpoint|health/.test(heard)) {
    return { url: ZTC_DEVOID_API, label: 'DEVOID API' }
  }
  if (/site|ztchosting|page d'?accueil|homepage|www|navigateur/.test(heard) || /ouvre.{0,20}(mon |notre |le )?site/.test(heard)) {
    return { url: ZTC_SITE, label: ZTC_SITE.replace(/\/$/, '') }
  }
  return null
}
