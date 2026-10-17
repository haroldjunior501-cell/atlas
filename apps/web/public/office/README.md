# Bureau pilote 3DGS

Asset actif :

- `pilot.ksplat` — environnement Gaussian Splatting (DropInViewer)

Remplacez-le par un scan indoor de votre bureau réel (`.ksplat`, `.splat` ou `.ply`) pour un rendu photoréaliste fidèle à vos locaux.

Pipeline ATLAS :

1. `generateLayout(org)` place pièces / bureaux / agents
2. `DropInViewer` charge ce fichier dans le lobby
3. Agents = `atlas.glb` + portraits / FLAME / ExAvatar
4. Gestes = `/api/atlas/avatar-motion` (PantoMatrix / PRIMAL si URL GPU)

Refs : https://github.com/mkkellogg/GaussianSplats3D
