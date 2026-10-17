export type SkillKind = 'lesson' | 'day' | 'document' | 'code' | 'search' | 'plan' | 'scan' | 'voice'

export type AgentStep = {
  label: string
  status: 'run' | 'ok' | 'err'
  detail?: string
}

export type SkillBoard = {
  kind: SkillKind
  title: string
  body: string
  question?: string
  steps?: AgentStep[]
}

export const SKILL_MENU: Array<{ id: SkillKind; label: string; hint: string; seed: string }> = [
  { id: 'lesson', label: 'Cours et exercices', hint: 'Comme un prof : j’explique, tu questions.', seed: 'Explique-moi cet exercice comme un professeur de faculté, clairement, étape par étape. Je pourrai te poser des questions ensuite.' },
  { id: 'day', label: 'Ma journée', hint: 'Tâches, agenda, priorités, rappels.', seed: 'Résume mes priorités du jour et organise ma journée.' },
  { id: 'search', label: 'Recherche web', hint: 'Je cherche et je te rapporte l’essentiel.', seed: 'Fais une recherche et donne-moi l’essentiel, avec les points utiles.' },
  { id: 'document', label: 'Documents', hint: 'Créer, modifier, résumer, analyser.', seed: 'Aide-moi sur ce document : résume, corrige, et dis-moi quoi en faire.' },
  { id: 'scan', label: 'Photo et scan', hint: 'Facture, tableau, capture, objet.', seed: 'Analyse cette image : lis le texte, le tableau ou la facture, et explique.' },
  { id: 'code', label: 'Code et projets', hint: 'Générer, expliquer, préparer un projet.', seed: 'Prépare le code ou le projet demandé, avec les fichiers et les étapes.' },
  { id: 'plan', label: 'Agents enchaînés', hint: 'Plusieurs actions, étapes visibles.', seed: 'Enchaîne les actions nécessaires. Montre chaque étape, le résultat, et les erreurs.' },
  { id: 'voice', label: 'Note vocale', hint: 'Dicter et transcrire.', seed: 'Transcris ce que je dicte, puis range-le proprement.' },
]

export function guessSkill(text: string, hasImage = false): SkillKind | null {
  const heard = text.toLowerCase()
  if (hasImage || /photo|scan|facture|formulaire|capture|screenshot|identifie|cam[eé]ra/.test(heard)) return 'scan'
  if (/exercice|cours|prof|facult[eé]|je n['’]ai pas compris|explique[- ]moi/.test(heard)) return 'lesson'
  if (/t[aâ]che|rappel|agenda|journ[eé]e|priorit[eé]/.test(heard)) return 'day'
  if (/cherche|recherche|internet|google|web/.test(heard)) return 'search'
  if (/code|projet|typescript|python|react|fonction/.test(heard)) return 'code'
  if (/pdf|document|fichier|r[eé]sume|modifie/.test(heard)) return 'document'
  if (/encha[iî]ne|plusieurs actions|agents?/.test(heard)) return 'plan'
  if (/dicte|transcri|note vocale/.test(heard)) return 'voice'
  return null
}

export function boardFromReply(kind: SkillKind, title: string, body: string, steps?: AgentStep[]): SkillBoard {
  const clean = body.replace(/\s+\n/g, '\n').trim()
  return {
    kind,
    title,
    body: clean.slice(0, 6000),
    question: kind === 'lesson' ? 'Qu’est-ce que tu n’as pas compris ? Pose ta question ici.' : undefined,
    steps,
  }
}
