import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { SkillBoard } from '../lib/skills'
import type { LifeTask } from '../lib/life'

export function SkillBoardCard({
  board,
  tasks,
  followUp,
  onFollowUp,
  onAsk,
  onToggle,
}: {
  board: SkillBoard
  tasks?: LifeTask[]
  followUp: string
  onFollowUp: (value: string) => void
  onAsk: () => void
  onToggle?: (id: string) => void
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{labelFor(board.kind)}</Text>
      <Text style={styles.title}>{board.title}</Text>
      <Text style={styles.body}>{board.body}</Text>

      {board.steps?.length ? (
        <View style={styles.steps}>
          {board.steps.map((step, index) => (
            <View key={`${step.label}-${index}`} style={styles.stepRow}>
              <Text style={[styles.dot, step.status === 'ok' ? styles.ok : step.status === 'err' ? styles.err : styles.run]}>
                {step.status === 'ok' ? '●' : step.status === 'err' ? '×' : '○'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepLabel}>{step.label}</Text>
                {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {tasks?.length ? (
        <View style={styles.tasks}>
          {tasks.slice(-12).map((task) => (
            <Pressable key={task.id} onPress={() => onToggle?.(task.id)} style={styles.task}>
              <Text style={styles.check}>{task.done ? '☑' : '☐'}</Text>
              <Text style={[styles.taskTitle, task.done && styles.done]}>{task.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {board.kind === 'lesson' ? (
        <View style={styles.ask}>
          <Text style={styles.askHint}>{board.question || 'Pose ta question sur ce que tu n’as pas compris.'}</Text>
          <TextInput
            style={styles.askInput}
            value={followUp}
            onChangeText={onFollowUp}
            placeholder="Je n’ai pas compris…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            returnKeyType="send"
            onSubmitEditing={onAsk}
          />
          <Pressable onPress={onAsk} style={styles.askBtn}>
            <Text style={styles.askBtnText}>Demander au prof</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function labelFor(kind: SkillBoard['kind']) {
  if (kind === 'lesson') return 'Cours'
  if (kind === 'day') return 'Journée'
  if (kind === 'document') return 'Document'
  if (kind === 'scan') return 'Scan'
  if (kind === 'code') return 'Code'
  if (kind === 'search') return 'Recherche'
  if (kind === 'plan') return 'Agents'
  return 'Note'
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
  },
  kicker: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  body: { color: '#e2e8f0', fontSize: 14, lineHeight: 21 },
  steps: { gap: 8, marginTop: 6 },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { fontSize: 14, marginTop: 1 },
  ok: { color: '#34d399' },
  err: { color: '#fb7185' },
  run: { color: '#38bdf8' },
  stepLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  stepDetail: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  tasks: { gap: 6, marginTop: 4 },
  task: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  check: { color: '#c4b5fd', fontSize: 16 },
  taskTitle: { color: '#e2e8f0', fontSize: 14, flex: 1 },
  done: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' },
  ask: { marginTop: 8, gap: 8 },
  askHint: { color: '#c4b5fd', fontSize: 12 },
  askInput: {
    color: '#fff',
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 8,
  },
  askBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: 'center',
  },
  askBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
