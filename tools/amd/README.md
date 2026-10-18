# AMD Instinct — outils de compétition

ATLAS parle à vLLM en OpenAI `/v1`. NVIDIA n’est **pas** remplacé : sans `AMD_VLLM_URL`, le chemin NIM reste inchangé.

## Obligatoire (jury AMD)

Sur le droplet MI300X / MI355 :

```bash
export AMD_VLLM_MODEL=nvidia/Nemotron-3-Super-120B-A12B
export ROCM_AITER_FA=1
./tools/amd/serve-nemotron.sh
```

Dans `.env` ATLAS :

```
AMD_VLLM_URL=http://<ip-droplet>:8000/v1
AMD_VLLM_MODEL=nvidia/Nemotron-3-Super-120B-A12B
AMD_VLLM_API_KEY=
```

Token Factory : `AMD_TOKENFACTORY_URL` + `AMD_TOKENFACTORY_API_KEY` (même contrat OpenAI).

## Optionnel — Gemma (prix Google)

Un processus vLLM sert en général **un** modèle. Second port :

```bash
export AMD_GEMMA_MODEL=google/gemma-3-12b-it
./tools/amd/serve-gemma.sh
```

```
AMD_GEMMA_URL=http://<ip-droplet>:8001/v1
AMD_GEMMA_MODEL=google/gemma-3-12b-it
```

Si Gemma est déjà dans `GET /v1/models` du serveur Nemotron, `AMD_GEMMA_URL` peut rester vide.

## Optionnel — Evolus (prix Business Agents)

Workspace événement (`app.evolus.ai` + code kickoff). Au moins deux briques : AI Tools summarize + compare. L’agent Evolus doit viser **le vLLM AMD de l’équipe**.

```
EVOLUS_API_KEY=
EVOLUS_APP_ID=
EVOLUS_AGENT_ID=
```

## Vérification

`GET /api/atlas/hackathon` et les pastilles AMD / Gemma / Evolus dans le bureau.
