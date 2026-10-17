# ATLAS Companion — assistant global Windows

Appelez **Atlas depuis n’importe quelle application** (Chrome, Word, Explorateur…).

## Prérequis

1. Atlas tourne en local :
   ```bash
   npm run dev:web
   ```
2. Windows PowerShell

## Lancer

```powershell
powershell -ExecutionPolicy Bypass -File tools/atlas-companion/Start-AtlasCompanion.ps1
```

Ou depuis la racine du repo :

```bash
npm run companion
```

## Utilisation

| Action | Effet |
|---|---|
| **Ctrl+Shift+A** | Ouvre / focus la fenêtre Atlas overlay |
| Double-clic icône tray | Idem |
| Clic droit tray → Quitter | Ferme le Companion |

Dans l’overlay : **parlez** (clic sur le visage) ou **écrivez** un ordre — mêmes capacités que le bureau (fichiers, apps, mails reliés, recherche…).

Lien « Ouvrir le studio » → plateforme complète `/bureau`.

## Notes

- Le Companion ne remplace pas `dev:web` : le cerveau Atlas reste sur `localhost:3000`.
- Reliez **Ordinateur** / **Fichiers** une fois dans le studio pour les actions PC.
- Si le raccourci est déjà pris par une autre app, changez-le dans le script (`0x41` = touche A).
