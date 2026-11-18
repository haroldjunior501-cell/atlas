# ATLAS Companion — assistant global Windows

Appelez **Atlas depuis n'importe quelle application** (Chrome, Word, Explorateur…).

## Prerequisites

1. Atlas reachable (production by default):
   - Public: `https://atlast.strimetv.site/overlay`
   - Or local: `npm run dev:web` then pass `-AtlasUrl http://localhost:3000/overlay`
2. Windows PowerShell

## Launch

```powershell
powershell -ExecutionPolicy Bypass -File tools/atlas-companion/Start-AtlasCompanion.ps1
```

Or from the repo root:

```bash
npm run companion
```

## Usage

| Action | Effect |
|---|---|
| **Ctrl+Shift+A** | Opens / focuses the Atlas overlay window |
| Double-click tray icon | Same |
| Right-click tray → Quitter | Closes the Companion |

In the overlay: **speak** (click the face) or **type** a command — same capabilities as the studio (files, apps, linked mail, search…).

Link "Ouvrir le studio" → full platform `/bureau`.

## Production

Default target is `https://atlast.strimetv.site/overlay` (public Cloudflare tunnel / zserver).

## Notes

- For local-only work, launch with `-AtlasUrl http://localhost:3000/overlay`.
- Link **Ordinateur** / **Fichiers** once in the studio for PC actions.
- If the hotkey is already taken, change it in the script (`0x41` = key A).
