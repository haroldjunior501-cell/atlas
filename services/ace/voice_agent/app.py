"""ATLAS listen-think-speak voice agent, following NVIDIA voice_agent_examples."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PIPELINE = ["listen", "think", "speak"]
LLM_URL = os.environ.get("AGENT_LLM_BASE_URL") or os.environ.get("NVIDIA_LLM_URL") or "http://atlas-llm:8080/v1"
LLM_MODEL = os.environ.get("AGENT_LLM_MODEL") or os.environ.get("NVIDIA_LLM_MODEL") or "qwen3-4b"
NVIDIA_URL = "https://integrate.api.nvidia.com/v1"
ASR_URL = os.environ.get("RIVA_ASR_URL") or os.environ.get("ASR_SERVER_URL") or ""
TTS_URL = os.environ.get("RIVA_TTS_URL") or os.environ.get("TTS_SERVER_URL") or ""


def api_key() -> str:
    return os.environ.get("NVIDIA_API_KEY", "").strip()


app = FastAPI(title="ATLAS ACE voice", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Turn(BaseModel):
    text: str = ""
    audio: str = ""
    voiceId: str = "French-Female"
    studio: dict[str, Any] | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "pipeline": PIPELINE,
        "llm": LLM_URL,
        "asr": bool(ASR_URL or api_key()),
        "tts": bool(TTS_URL or api_key()),
    }


@app.post("/v1/voice/turn")
async def turn(body: Turn) -> dict[str, Any]:
    heard = body.text.strip()
    if not heard and body.audio:
        heard = await transcribe(body.audio)
    if not heard:
        return {"heard": "", "reply": "Je vous écoute.", "pipeline": PIPELINE}
    reply = await think(heard, body.studio)
    audio = await speak(reply, body.voiceId)
    return {
        "heard": heard,
        "reply": reply,
        "pipeline": PIPELINE,
        "audio": audio,
        "source": "ace-llm",
    }


async def transcribe(audio: str) -> str:
    key = api_key()
    target = ASR_URL.rstrip("/") if ASR_URL.startswith("http") else f"{NVIDIA_URL}/chat/completions"
    if not key and not ASR_URL:
        return ""
    headers = {"authorization": f"Bearer {key}", "content-type": "application/json"} if key else {"content-type": "application/json"}
    payload: dict[str, Any]
    if ASR_URL.startswith("http"):
        payload = {"model": os.environ.get("ASR_MODEL_NAME", "nvidia/parakeet"), "language": "fr-FR", "file": audio}
    else:
        payload = {
            "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "temperature": 0,
            "max_tokens": 80,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": {"data": audio, "format": "wav"}},
                    {"type": "text", "text": "Transcris uniquement les mots prononcés."},
                ],
            }],
        }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(target if ASR_URL.startswith("http") else f"{NVIDIA_URL}/chat/completions", headers=headers, json=payload)
        if not response.is_success:
            return ""
        data = response.json()
        return (data.get("text") or data.get("transcript") or data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()


async def think(heard: str, studio: dict[str, Any] | None) -> str:
    key = api_key()
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"
    payload = {
        "model": LLM_MODEL,
        "temperature": 0.5,
        "max_tokens": 260,
        "messages": [
            {"role": "system", "content": "Tu es Atlas. Réponds en 2 à 5 phrases à voix haute. Pipeline écouter-penser-parler."},
            {"role": "user", "content": f"Studio: {studio}\nDemande: {heard}"},
        ],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{LLM_URL.rstrip('/')}/chat/completions", headers=headers, json=payload)
        if response.is_success:
            text = response.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if text:
                return text
        if key:
            payload["model"] = os.environ.get("NVIDIA_NIM_MODEL") or "meta/llama-3.2-11b-vision-instruct"
            cloud = await client.post(f"{NVIDIA_URL}/chat/completions", headers=headers, json=payload)
            if cloud.is_success:
                return cloud.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip() or heard
    return heard


async def speak(text: str, voice_id: str) -> str | None:
    key = api_key()
    target = TTS_URL.rstrip("/") + "/v1/audio/speech" if TTS_URL.startswith("http") else f"{NVIDIA_URL}/audio/speech"
    if not key and not TTS_URL.startswith("http"):
        return None
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"
    payload = {
        "model": os.environ.get("TTS_MODEL_NAME", "nvidia/magpie-tts-multilingual"),
        "input": text[:500],
        "voice": os.environ.get("TTS_VOICE_ID") or voice_id,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(target, headers=headers, json=payload)
        if not response.is_success:
            return None
        return response.content.hex() if response.headers.get("content-type", "").startswith("audio") else None
