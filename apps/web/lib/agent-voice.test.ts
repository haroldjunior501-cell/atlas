import assert from 'node:assert/strict'
import test from 'node:test'
import { agentFallback, agentSystemPrompt, parseMeeting } from './agent-voice'

const sarah = { firstName: 'Sarah', lastName: 'Moreau', role: 'CMO', mission: 'Faire connaître l’offre.', skills: ['SEO'], traits: ['créative'], delegation: 'approval' }

test('un employé parle depuis sa fiche', () => {
  const prompt = agentSystemPrompt(sarah, 'CyberNova', ['Thomas (Sales)'])
  assert.match(prompt, /Sarah Moreau, CMO chez CyberNova/)
  assert.match(prompt, /accord du dirigeant/)
  assert.match(prompt, /aucun n’est relié|aucun outil n’est encore assigné/)
  assert.match(prompt, /Aucune collection ne t’est ouverte/)
  const withDossier = agentSystemPrompt({ ...sarah, knowledge: ['Playbook vente'], voice: 'Hortense' }, 'CyberNova', ['Thomas (Sales)'])
  assert.match(withDossier, /Playbook vente/)
  assert.match(withDossier, /Hortense/)
  assert.match(agentFallback(sarah, ''), /Sarah/)
})

test('le compte rendu de réunion est validé, sinon remplacé', () => {
  const good = parseMeeting('{"positions":["Sarah (CMO) : campagne prête"],"decision":"Lancer le 15 octobre."}', 'lancement', [sarah])
  assert.equal(good.decision, 'Lancer le 15 octobre.')
  const broken = parseMeeting('pas de json', 'lancement', [sarah])
  assert.match(broken.decision, /lancement/)
  assert.equal(broken.positions.length, 1)
})
