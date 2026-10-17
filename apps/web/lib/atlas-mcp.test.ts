import test from 'node:test'
import assert from 'node:assert/strict'
import { CONNECTOR_CATALOG, connectorOf } from '@atlas/domain'
import { allowedMcpUrl, isUnsafeMachine, isWriteTool } from './atlas-mcp'

test('le catalogue couvre mail, calendrier, CRM, machine et MCP', () => {
  assert.ok(CONNECTOR_CATALOG.length >= 20)
  assert.ok(connectorOf('gmail')?.capabilities.includes('Envoyer'))
  assert.equal(connectorOf('n8n')?.category, 'automation')
  assert.equal(connectorOf('machine')?.category, 'machine')
})

test('MCP refuse les URL internes et les commandes machine dangereuses', () => {
  assert.equal(allowedMcpUrl('https://n8n.example/mcp'), true)
  assert.equal(allowedMcpUrl('http://127.0.0.1:5678/mcp'), true)
  assert.equal(allowedMcpUrl('file:///etc/passwd'), false)
  assert.equal(allowedMcpUrl('http://169.254.169.254/latest'), false)
  assert.equal(isWriteTool('send_email', ''), true)
  assert.equal(isWriteTool('reply_email', ''), true)
  assert.equal(isWriteTool('prepare_reply', ''), false)
  assert.equal(isWriteTool('list_messages', ''), false)
  assert.equal(isWriteTool('create_document', ''), false)
  assert.equal(isWriteTool('write_document', ''), false)
  assert.equal(isUnsafeMachine('rm -rf /'), true)
  assert.equal(isUnsafeMachine('systemctl status nginx'), false)
})
