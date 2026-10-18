#!/usr/bin/env bash
# Sert Nemotron 3 Super sur AMD Instinct (MI300X / MI355) via vLLM + ROCm.
# N’efface rien côté NVIDIA : ATLAS appelle cet endpoint seulement si AMD_VLLM_URL est défini.
set -euo pipefail

MODEL="${AMD_VLLM_MODEL:-nvidia/Nemotron-3-Super-120B-A12B}"
PORT="${AMD_VLLM_PORT:-8000}"
PARSER="${AMD_TOOL_CALL_PARSER:-hermes}"
export ROCM_AITER_FA="${ROCM_AITER_FA:-1}"

args=(
  --model "${MODEL}"
  --host 0.0.0.0
  --port "${PORT}"
  --dtype auto
  --trust-remote-code
  --enable-auto-tool-choice
  --tool-call-parser "${PARSER}"
)
if [[ -n "${AMD_VLLM_API_KEY:-}" ]]; then
  args+=(--api-key "${AMD_VLLM_API_KEY}")
fi

echo "vLLM ${MODEL} on :${PORT}  ROCM_AITER_FA=${ROCM_AITER_FA}  parser=${PARSER}"
exec python -m vllm.entrypoints.openai.api_server "${args[@]}"
