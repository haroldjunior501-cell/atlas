import type { Agent, AgentAction, PermissionDecision } from '@atlas/domain'

export function evaluatePermission(agent: Agent, action: AgentAction): PermissionDecision {
  const rule = agent.permissions.find((permission) => permission.action === action.type)

  if (agent.delegation === 'restricted' && action.kind === 'act') {
    return {
      outcome: 'denied',
      action: action.type,
      reason: `${agent.firstName} peut analyser, pas agir.`,
    }
  }

  if (!rule || !rule.allowed) {
    return {
      outcome: 'denied',
      action: action.type,
      reason: `Permission absente pour ${action.type}.`,
    }
  }

  const overLimit =
    rule.spendLimit !== null && action.amount !== null && action.amount > rule.spendLimit

  const sensitive = action.kind === 'act' || action.amount !== null
  if ((agent.delegation === 'approval' && sensitive) || rule.requiresApproval || overLimit) {
    return {
      outcome: 'approval_required',
      action: action.type,
      reason: overLimit
        ? `Dépense au-dessus du plafond de ${rule.spendLimit} €.`
        : 'Cette action demande une validation du CEO.',
    }
  }

  return {
    outcome: 'allowed',
    action: action.type,
    reason: 'Autorisé par les permissions explicites de l’agent.',
  }
}
