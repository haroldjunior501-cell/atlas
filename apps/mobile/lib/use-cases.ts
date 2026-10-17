export type UseCaseId =
  | 'day'
  | 'automate'
  | 'team'
  | 'project'
  | 'data'
  | 'learn'
  | 'business'
  | 'other'

export type UseCase = {
  id: UseCaseId
  label: string
  hint: string
}

export const USE_CASES: UseCase[] = [
  { id: 'day', label: 'Organiser ma journée', hint: 'Priorités, agenda, focus' },
  { id: 'automate', label: 'Automatiser une tâche', hint: 'Répétitif → délégué' },
  { id: 'team', label: 'Mon équipe d’agents', hint: 'Recruter, diriger, suivre' },
  { id: 'project', label: 'Lancer un projet', hint: 'De l’idée au premier livrable' },
  { id: 'data', label: 'Comprendre mes données', hint: 'Signaux, décisions, clarté' },
  { id: 'learn', label: 'Apprendre & progresser', hint: 'Coaching, skills, rythme' },
  { id: 'business', label: 'Piloter mon entreprise', hint: 'Ops, cash, croissance' },
  { id: 'other', label: 'Autre besoin', hint: 'Dis-nous ce qui compte' },
]
