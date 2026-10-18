#!/usr/bin/env bash
# Gemma 3 sur Instinct — prix partenaire Google. Un vLLM = un modèle : second port par défaut.
# ATLAS lit AMD_GEMMA_URL (sinon retombe sur AMD_VLLM_URL si Gemma y est listé).
set -euo pipefail

MODEL="${AMD_GEMMA_MODEL:-google/gemma-3-12b-it}"
PORT="${AMD_GEMMA_PORT:-8001}"
export ROCM_AITER_FA="${ROCM_AITER_FA:-1}"

args=(
  --model "${MODEL}"
  --host 0.0.0.0
  --port "${PORT}"
  --dtype auto
  --trust-remote-code
)
if [[ -n "${AMD_VLLM_API_KEY:-}" ]]; then
  args+=(--api-key "${AMD_VLLM_API_KEY}")
fi

echo "vLLM ${MODEL} on :${PORT}  ROCM_AITER_FA=${ROCM_AITER_FA}"
exec python -m vllm.entrypoints.openai.api_server "${args[@]}"
