import test from 'node:test'
import assert from 'node:assert/strict'
import { isOauthProvider, oauthAuthorizeUrl, capabilityTools, organizationGrant } from './atlas-oauth'
import { publicLink } from './atlas-mcp-store'

test('gmail, calendar et notion sont des outils OAuth', () => {
  assert.equal(isOauthProvider('gmail'), true)
  assert.equal(isOauthProvider('google_calendar'), true)
  assert.equal(isOauthProvider('notion'), true)
  assert.equal(isOauthProvider('mcp'), false)
})

test('l’URL d’autorisation Google ne montre jamais le serveur interne', () => {
  const href = oauthAuthorizeUrl('gmail', 'client-id', 'http://localhost:3000/api/atlas/oauth/callback', 'nonce-1')
  const url = new URL(href)
  assert.equal(url.hostname, 'accounts.google.com')
  assert.equal(url.searchParams.get('client_id'), 'client-id')
  assert.equal(url.searchParams.get('state'), 'nonce-1')
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('prompt'), 'consent')
  assert.match(url.searchParams.get('scope') ?? '', /gmail/)
  assert.doesNotMatch(href, /mcp|n8n|bearer/i)
})

test('Notion demande un compte utilisateur, sans jargon technique', () => {
  const href = oauthAuthorizeUrl('notion', 'id', 'http://localhost:3000/callback', 'abc')
  const url = new URL(href)
  assert.equal(url.searchParams.get('owner'), 'user')
  assert.equal(capabilityTools('gmail').length > 0, true)
})

test('seul le bureau local peut être autorisé sans OAuth fournisseur', () => {
  const grant = organizationGrant('machine')
  assert.ok(grant)
  assert.equal(grant.status, 'connected')
  assert.equal(organizationGrant('inconnu'), null)
  assert.equal(organizationGrant('notion'), null)
  assert.equal(organizationGrant('gmail'), null)
  assert.equal(organizationGrant('outlook'), null)
  assert.ok(organizationGrant('filesystem'))
})

test('le lien public masque l’adresse et le jeton', () => {
  const pub = publicLink({
    id: '1',
    organizationId: 'org',
    provider: 'gmail',
    kind: 'oauth',
    url: 'https://oauth2.googleapis.com/token',
    token: 'secret-token',
    tools: [{ name: 'Envoyer', description: 'Envoyer' }],
    status: 'connected',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  assert.equal(pub.url, '')
  assert.equal('token' in pub, false)
})
