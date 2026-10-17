import assert from 'node:assert/strict'
import test from 'node:test'
import { extractAppRequest, matchDesktopApp } from './atlas-desktop'
import { parseAppControl, resolveDriver } from './atlas-desktop-control'
import { interpretAtlas } from './atlas-voice'

test('extrait le nom d’app depuis une phrase vocale', () => {
  assert.equal(extractAppRequest('ouvre Spotify'), 'Spotify')
  assert.equal(extractAppRequest('lance Discord sur mon pc'), 'Discord')
  assert.equal(extractAppRequest('démarre l’application Notion'), 'Notion')
  assert.equal(matchDesktopApp('ouvre word'), 'word')
  assert.equal(matchDesktopApp('chrome'), 'chrome')
})

test('parse le pilotage in-app Spotify / Notion', () => {
  const play = parseAppControl('joue le son de tiakola dans spotify')
  assert.ok(play)
  assert.equal(play?.intent, 'play')
  assert.match(play?.query || '', /tiakola/i)
  assert.match(play?.app || '', /spotify/i)
  assert.equal(resolveDriver('spotify')?.id, 'spotify')

  const ninho = parseAppControl('lance le son de ninho dans spotify')
  assert.ok(ninho)
  assert.equal(ninho?.intent, 'play')
  assert.match(ninho?.query || '', /ninho/i)
  assert.match(ninho?.app || '', /spotify/i)

  const bare = parseAppControl('joue ninho')
  assert.equal(bare?.intent, 'play')
  assert.match(bare?.query || '', /ninho/i)
  assert.match(bare?.app || '', /spotify/i)

  const shopifyTypo = parseAppControl('joue tiakola dans shopify')
  assert.equal(shopifyTypo?.intent, 'play')
  assert.match(shopifyTypo?.app || '', /shopify/i)

  const notion = parseAppControl('cherche budget dans Notion')
  assert.equal(notion?.intent, 'search')
  assert.match(notion?.query || '', /budget/i)
})

test('ouvre une app installée et liste les applications', () => {
  const open = interpretAtlas('ouvre Spotify')
  assert.equal(open.kind, 'invoke')
  if (open.kind === 'invoke') {
    assert.equal(open.provider, 'machine')
    assert.equal(open.tool, 'open_app')
    assert.match(open.input, /Spotify/i)
  }
  const list = interpretAtlas('liste mes applications installées')
  assert.equal(list.kind, 'invoke')
  if (list.kind === 'invoke') {
    assert.equal(list.provider, 'machine')
    assert.equal(list.tool, 'list_apps')
  }
  const word = interpretAtlas('ouvre Word')
  assert.equal(word.kind, 'invoke')
  if (word.kind === 'invoke') assert.equal(word.tool, 'open_app')
})

test('pilote une action dans Spotify via la voix', () => {
  const action = interpretAtlas('joue le son de tiakola dans spotify')
  assert.equal(action.kind, 'invoke')
  if (action.kind === 'invoke') {
    assert.equal(action.provider, 'machine')
    assert.equal(action.tool, 'control_app')
    assert.match(action.input, /tiakola/i)
  }
  const lance = interpretAtlas('lance le son de ninho dans spotify')
  assert.equal(lance.kind, 'invoke')
  if (lance.kind === 'invoke') {
    assert.equal(lance.provider, 'machine')
    assert.equal(lance.tool, 'control_app')
    assert.match(lance.input, /ninho/i)
  }
  const mets = interpretAtlas('mets du ninho sur spotify')
  assert.equal(mets.kind, 'invoke')
  if (mets.kind === 'invoke') assert.equal(mets.tool, 'control_app')
})
