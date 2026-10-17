import assert from 'node:assert/strict'
import test from 'node:test'
import { refineAtlasAction, refineInvokeInput, resolveAtlasAction, shouldConsultLlm } from './atlas-execute'
import { interpretAtlas } from './atlas-voice'

test('crée un fichier Orelle → titre exact, corps vide', () => {
  const heard = 'crée un fichier et norme le Orelle'
  const local = interpretAtlas(heard)
  const action = refineAtlasAction(heard, local)
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') {
    const payload = JSON.parse(action.input) as { title: string; body: string }
    assert.equal(payload.title, 'Orelle')
    assert.equal(payload.body, '')
  }
})

test('ne laisse pas la commande utilisateur dans le corps du fichier', () => {
  const heard = 'crée un fichier nommé Brief'
  const dirty = refineInvokeInput(
    heard,
    'filesystem',
    'create_document',
    JSON.stringify({ title: 'Brief', body: heard, open: true }),
  )
  const payload = JSON.parse(dirty) as { title: string; body: string }
  assert.equal(payload.title, 'Brief')
  assert.equal(payload.body, '')
})

test('un answer LLM cède la place à un invoke local précis', () => {
  const heard = 'lis mon dernier mail'
  const action = resolveAtlasAction(heard, interpretAtlas(heard), { kind: 'answer', text: heard })
  assert.equal(action.kind, 'mail')
})

test('le LLM compose ne vole pas une création de fichier', () => {
  const heard = 'crée un fichier nommé Orelle'
  const action = resolveAtlasAction(
    heard,
    { kind: 'answer', text: heard },
    { kind: 'compose', text: 'marque de vêtements' },
  )
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') {
    assert.equal(JSON.parse(action.input).title, 'Orelle')
  }
})

test('shouldConsultLlm pour answer et listen', () => {
  assert.equal(shouldConsultLlm({ kind: 'listen' }, 'salut'), true)
  assert.equal(shouldConsultLlm({ kind: 'answer', text: 'aide-moi' }, 'aide-moi'), true)
  assert.equal(shouldConsultLlm({ kind: 'approve' }, 'approuve'), false)
})

test('extract / transform gagnent sur un answer LLM vague', () => {
  const extractHeard = 'extrais les noms du fichier CompteRendu'
  const extract = resolveAtlasAction(extractHeard, interpretAtlas(extractHeard), { kind: 'answer', text: extractHeard })
  assert.equal(extract.kind, 'extract')
  if (extract.kind === 'extract') {
    assert.equal(extract.focus, 'people')
    assert.equal(extract.source, 'CompteRendu')
  }
  const transformHeard = 'reformule le fichier Note en puces'
  const transform = refineAtlasAction(transformHeard, { kind: 'draft', format: 'document', topic: transformHeard })
  assert.equal(transform.kind, 'transform')
  if (transform.kind === 'transform') assert.equal(transform.op, 'bullets')
})
