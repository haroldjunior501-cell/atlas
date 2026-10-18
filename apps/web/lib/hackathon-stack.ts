import { amdGemmaModel, amdGemmaUrl, amdProbe, amdVllmModel, amdVllmUrl } from './amd-vllm'
import { evolusConfigured, evolusHealth } from './evolus'

export async function hackathonStack() {
  const amdUrl = amdVllmUrl()
  const gemmaUrl = amdGemmaUrl()
  const [amd, gemma, evolus] = await Promise.all([
    amdProbe(amdUrl),
    gemmaUrl && gemmaUrl !== amdUrl ? amdProbe(gemmaUrl) : Promise.resolve(null),
    evolusHealth(),
  ])
  const amdLive = amd.ok
  const gemmaLive = Boolean(amd.models.some((id) => /gemma/i.test(id)) || gemma?.ok)
  return {
    required: {
      amd: {
        required: true,
        configured: Boolean(amdUrl),
        live: amdLive,
        model: amdVllmModel(),
        urlHost: hostOf(amdUrl),
        latencyMs: amd.latencyMs,
        models: amd.models,
        note: amdUrl ? amd.note : 'Renseignez AMD_VLLM_URL (droplet MI300X vLLM ou Token Factory). NVIDIA n’est pas touché.',
      },
    },
    partners: {
      gemma: {
        required: false,
        prize: 'Google 5 000 $',
        configured: Boolean(amdGemmaUrl()),
        live: gemmaLive,
        model: amdGemmaModel(),
        note: gemmaLive ? 'Gemma visible sur l’endpoint AMD' : 'Servez Gemma sur le même vLLM ou AMD_GEMMA_URL.',
      },
      evolus: {
        required: false,
        prize: 'Evolus Business Agents',
        configured: evolusConfigured(),
        live: evolus.ok,
        agents: evolus.agents,
        tools: evolus.tools,
        note: evolus.note,
        blocks: ['AI Tools (summarize + compare)', 'Agent chat', 'Knowledge library si EVOLUS_LIBRARY_ID'],
      },
    },
    nvidiaUntouched: true,
  }
}

function hostOf(raw: string) {
  try {
    return raw ? new URL(raw).host : ''
  } catch {
    return ''
  }
}
