import { thinkWithLlm } from '@/lib/ace-runtime'

export async function nemotron(system: string, user: string, tokens: number, timeoutMs = 9000): Promise<string> {
  return thinkWithLlm(system, user, tokens, timeoutMs)
}
