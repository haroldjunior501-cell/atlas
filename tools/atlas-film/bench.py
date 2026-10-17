"""Banc ATLAS Film — une seule chaîne, quatre modèles.

Ordre, du plan jusqu'au fichier final :
  1. Open-Sora     plaque texte → vidéo          https://github.com/hpcaitech/Open-Sora
  2. SkyReels V2   qualité cinéma, durée         https://github.com/skyworkai/skyreels-v2
  3. EverAnimate  identité du personnage         https://github.com/vita-epfl/EverAnimate
  4. MOVA          voix, lèvres et sons calés    https://github.com/OpenMOSS/MOVA

Dossiers (clones locaux) :
  ATLAS_OPEN_SORA_HOME, ATLAS_SKYREELS_HOME, ATLAS_EVERANIMATE_HOME, ATLAS_MOVA_HOME
  ATLAS_MOVA_CKPT   poids MOVA (défaut : <home>/checkpoints)
  ATLAS_SKYREELS_MODEL  défaut Skywork/SkyReels-V2-DF-14B-720P
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("ATLAS_FILM_PORT", "7870"))
ROOT = Path(__file__).resolve().parent
JOBS = ROOT / "jobs"
LOCK = threading.Lock()
BUSY = {"id": ""}


def home(name: str) -> Path | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    path = Path(raw)
    return path if path.is_dir() else None


def stages() -> dict[str, bool]:
    mova = home("ATLAS_MOVA_HOME")
    ckpt = os.environ.get("ATLAS_MOVA_CKPT", "").strip()
    mova_ready = bool(mova and (ckpt or (mova / "scripts" / "inference_single.py").is_file()))
    ever = home("ATLAS_EVERANIMATE_HOME")
    return {
        "open-sora": bool(home("ATLAS_OPEN_SORA_HOME") and (home("ATLAS_OPEN_SORA_HOME") / "scripts").is_dir()),
        "skyreels": bool(home("ATLAS_SKYREELS_HOME") and (home("ATLAS_SKYREELS_HOME") / "generate_video_df.py").is_file()),
        "everanimate": bool(ever and ever_script(ever)),
        "mova": mova_ready,
    }


def ever_script(folder: Path) -> Path | None:
    for relative in ("inference.py", "infer.py", "scripts/inference.py", "scripts/infer.py"):
        candidate = folder / relative
        if candidate.is_file():
            return candidate
    return None


def newest_mp4(folder: Path, since: float) -> Path | None:
    found = [item for item in folder.rglob("*.mp4") if item.stat().st_mtime >= since - 1]
    if not found:
        return None
    return max(found, key=lambda item: item.stat().st_mtime)


def run(cmd: list[str], cwd: Path, timeout: int) -> tuple[int, str]:
    try:
        done = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as error:
        return 127, str(error)
    except subprocess.TimeoutExpired:
        return 124, "temps dépassé"
    tail = (done.stderr or done.stdout or "")[-500:]
    return done.returncode, tail.strip()


def frames_for(seconds: int) -> int:
    if seconds >= 10:
        return 257
    return 97


def take_open_sora(prompt: str, out: Path) -> tuple[Path | None, str]:
    folder = home("ATLAS_OPEN_SORA_HOME")
    if not folder:
        return None, "Open-Sora non installé (ATLAS_OPEN_SORA_HOME)"
    script = folder / "scripts" / "diffusion" / "inference.py"
    if not script.is_file():
        return None, "scripts/diffusion/inference.py introuvable"
    out.mkdir(parents=True, exist_ok=True)
    configs = list((folder / "configs").rglob("*256px*.py")) or list((folder / "configs").rglob("*t2v*.py"))
    cmd = [sys.executable, "-m", "torch.distributed.run", "--nproc_per_node", "1", "--standalone", str(script)]
    if configs:
        cmd.append(str(configs[0]))
    cmd += ["--save-dir", str(out), "--prompt", prompt]
    started = time.time()
    code, tail = run(cmd, folder, 900)
    clip = newest_mp4(out, started)
    if code == 0 and clip:
        return clip, "ok"
    return None, tail or f"Open-Sora code {code}"


def take_skyreels(prompt: str, out: Path, plate: Path | None, seconds: int) -> tuple[Path | None, str]:
    folder = home("ATLAS_SKYREELS_HOME")
    if not folder:
        return None, "SkyReels V2 non installé (ATLAS_SKYREELS_HOME)"
    script = folder / "generate_video_df.py"
    if not script.is_file():
        return None, "generate_video_df.py introuvable"
    out.mkdir(parents=True, exist_ok=True)
    model = os.environ.get("ATLAS_SKYREELS_MODEL", "Skywork/SkyReels-V2-DF-14B-720P")
    extending = bool(plate and plate.is_file())
    cmd = [
        sys.executable, str(script),
        "--model_id", model,
        "--resolution", "720P",
        "--ar_step", "0" if extending else "5",
        "--base_num_frames", "97",
        "--num_frames", str(frames_for(seconds)),
        "--overlap_history", "17",
        "--addnoise_condition", "20",
        "--offload",
        "--prompt", prompt,
    ]
    if not extending:
        cmd += ["--causal_block_size", "5"]
    if extending and plate:
        cmd += ["--video_path", str(plate)]
    started = time.time()
    code, tail = run(cmd, folder, 1800)
    clip = newest_mp4(out, started) or newest_mp4(folder, started)
    if code == 0 and clip:
        kept = out / "skyreels.mp4"
        if clip.resolve() != kept.resolve():
            shutil.copyfile(clip, kept)
        return kept, "ok"
    return None, tail or f"SkyReels code {code}"


def take_everanimate(prompt: str, out: Path, frame: Path | None) -> tuple[Path | None, str]:
    folder = home("ATLAS_EVERANIMATE_HOME")
    if not folder:
        return None, "EverAnimate non installé (ATLAS_EVERANIMATE_HOME)"
    script = ever_script(folder)
    if not script:
        return None, "script d'inférence EverAnimate introuvable"
    out.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, str(script), "--prompt", prompt, "--output", str(out / "everanimate.mp4")]
    if frame and frame.is_file():
        cmd += ["--image", str(frame), "--ref", str(frame)]
    started = time.time()
    code, tail = run(cmd, folder, 1800)
    clip = out / "everanimate.mp4"
    if code == 0 and clip.is_file():
        return clip, "ok"
    found = newest_mp4(out, started)
    if code == 0 and found:
        return found, "ok"
    return None, tail or f"EverAnimate code {code}"


def first_frame(clip: Path, dest: Path) -> Path | None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None
    code, _tail = run([ffmpeg, "-y", "-i", str(clip), "-frames:v", "1", str(dest)], dest.parent, 60)
    return dest if code == 0 and dest.is_file() else None


def take_mova(prompt: str, speech: str, out: Path, frame: Path | None) -> tuple[Path | None, str]:
    folder = home("ATLAS_MOVA_HOME")
    if not folder:
        return None, "MOVA non installé (ATLAS_MOVA_HOME)"
    script = folder / "scripts" / "inference_single.py"
    if not script.is_file():
        return None, "scripts/inference_single.py introuvable"
    out.mkdir(parents=True, exist_ok=True)
    ckpt = os.environ.get("ATLAS_MOVA_CKPT", "").strip() or str(folder / "checkpoints")
    spoken = f'{prompt} He says: "{speech}"' if speech else prompt
    cmd = [
        sys.executable, "-m", "torch.distributed.run", "--nproc_per_node", "1",
        str(script),
        "--ckpt_path", ckpt,
        "--cp_size", "1",
        "--height", os.environ.get("ATLAS_MOVA_HEIGHT", "720"),
        "--width", os.environ.get("ATLAS_MOVA_WIDTH", "1280"),
        "--prompt", spoken,
        "--output_path", str(out / "mova.mp4"),
        "--seed", "42",
        "--offload", "cpu",
    ]
    if frame and frame.is_file():
        cmd += ["--ref_path", str(frame)]
    code, tail = run(cmd, folder, 2400)
    clip = out / "mova.mp4"
    if code == 0 and clip.is_file():
        return clip, "ok"
    return None, tail or f"MOVA code {code}"


def render(job: dict) -> dict:
    prompt = str(job.get("visual") or job.get("prompt") or "").strip()
    speech = str(job.get("speech") or "").strip()
    cast = "person" if str(job.get("cast") or "") == "person" else "scene"
    seconds = max(4, min(12, int(job.get("seconds") or 8)))
    work = JOBS / uuid.uuid4().hex[:12]
    work.mkdir(parents=True, exist_ok=True)
    report: list[dict] = []
    plate: Path | None = None

    clip, reason = take_open_sora(prompt, work / "open-sora")
    (work / "open-sora").mkdir(exist_ok=True)
    report.append({"name": "open-sora", "ok": bool(clip), "reason": reason})
    if clip:
        plate = clip

    clip, reason = take_skyreels(prompt, work / "skyreels", plate, seconds)
    (work / "skyreels").mkdir(exist_ok=True)
    report.append({"name": "skyreels", "ok": bool(clip), "reason": reason})
    if clip:
        plate = clip

    frame = first_frame(plate, work / "frame.png") if plate else None
    if cast == "person":
        clip, reason = take_everanimate(prompt, work / "everanimate", frame)
        (work / "everanimate").mkdir(exist_ok=True)
        report.append({"name": "everanimate", "ok": bool(clip), "reason": reason})
        if clip:
            plate = clip
            frame = first_frame(plate, work / "frame-hero.png") or frame
    else:
        report.append({"name": "everanimate", "ok": False, "reason": "scène sans personnage, étape laissée"})

    clip, reason = take_mova(prompt, speech, work / "mova", frame)
    (work / "mova").mkdir(exist_ok=True)
    report.append({"name": "mova", "ok": bool(clip), "reason": reason})
    if clip:
        plate = clip

    if not plate:
        return {"ok": False, "stages": report, "error": "Aucun modèle n'a rendu de vidéo."}
    final = work / "film.mp4"
    if plate.resolve() != final.resolve():
        shutil.copyfile(plate, final)
    used = [item["name"] for item in report if item["ok"]]
    return {"ok": True, "path": str(final), "stages": report, "used": used}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def _json(self, code: int, body: dict) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] != "/health":
            self._json(404, {"ok": False})
            return
        self._json(200, {"ok": True, "stages": stages()})

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/v1/film":
            self._json(404, {"ok": False})
            return
        length = int(self.headers.get("content-length") or "0")
        try:
            job = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "JSON invalide"})
            return
        if not LOCK.acquire(blocking=False):
            self._json(409, {"ok": False, "error": "Un film est déjà en cours."})
            return
        try:
            BUSY["id"] = "run"
            self._json(200, render(job if isinstance(job, dict) else {}))
        finally:
            BUSY["id"] = ""
            LOCK.release()


def main() -> None:
    JOBS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
