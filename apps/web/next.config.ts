import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

function loadRootEnv() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ]
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    const value = trimmed.slice(separator + 1).trim()
    if (process.env[key] === undefined || process.env[key] === 'http://localhost:4000') process.env[key] = value
  }
}

loadRootEnv()

const nextConfig: NextConfig = {
  // Tunnel / reverse-proxy (atlast.strimetv.site): without this, Next blocks /_next/*
  // with 403, React never hydrates, and forms do a dead native GET submit.
  allowedDevOrigins: [
    'atlast.strimetv.site',
    '*.strimetv.site',
    'localhost',
    '127.0.0.1',
  ],
  env: {
    NEXT_PUBLIC_ATLAS_GATEWAY_URL: process.env.NEXT_PUBLIC_ATLAS_GATEWAY_URL,
  },
  transpilePackages: ['@atlas/domain', '@atlas/contracts', '@mkkellogg/gaussian-splats-3d'],
}

export default nextConfig
