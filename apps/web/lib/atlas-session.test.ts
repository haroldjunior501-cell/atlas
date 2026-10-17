import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSessionContext,
  expandWithSession,
  rememberSessionAction,
} from './atlas-session'
import { interpretAtlas } from './atlas-voice'
import { refineAtlasAction } from './atlas-execute'

test('écrire dans Orelle extrait le bon message', () => {
  const action = interpretAtlas('ecris dans le fichier Orelle le message si, j\'aime ma soeur')
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') {
    assert.equal(action.tool, 'write_document')
    const payload = JSON.parse(action.input) as { title: string; body: string }
    assert.equal(payload.title, 'Orelle')
    assert.match(payload.body, /aime ma soeur/i)
    assert.doesNotMatch(payload.body, /ecris|fichier/i)
  }
})

test('continuité : écris dedans utilise le dernier fichier', () => {
  const ctx = createSessionContext()
  rememberSessionAction(ctx, {
    kind: 'invoke',
    provider: 'filesystem',
    tool: 'create_document',
    input: JSON.stringify({ title: 'Orelle', body: '', open: true }),
  })
  assert.equal(ctx.lastFile, 'Orelle')
  const expanded = expandWithSession('écris dedans bonjour famille', ctx)
  assert.match(expanded, /fichier Orelle/i)
  const action = refineAtlasAction(expanded, interpretAtlas(expanded))
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') {
    assert.equal(action.tool, 'write_document')
    const payload = JSON.parse(action.input) as { title: string; body: string }
    assert.equal(payload.title, 'Orelle')
    assert.match(payload.body, /bonjour famille/i)
  }
})

test('crée un fichier reste create_document', () => {
  const action = interpretAtlas('crée un fichier et norme le Orelle')
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') assert.equal(action.tool, 'create_document')
})
