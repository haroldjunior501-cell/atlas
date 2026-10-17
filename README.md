# ATLAS

Système d’exploitation pour organisations d’employés IA. Ce dépôt est autonome : il ne fait pas partie des autres projets du poste.

Positionnement : **Create. Operate. Delegate.** L’utilisateur est le CEO. Un agent n’agit au-delà de ses permissions explicites.

## Couches

| Couche | Rôle | Code |
|---|---|---|
| Studio | Construire l’organisation | `apps/web` |
| OS | Piloter au quotidien | `apps/web` et `apps/mobile` |
| Voice | Jarvis, briefing et présence parlée | `services/orchestrator` (`jarvis.ts`), écran bureau |
| Swarm | Découper une mission entre agents | `services/orchestrator` |
| Connect | Outils externes | `connectors` |

```
Web (Studio + OS)          Mobile (OS + Voice)
            \                  /
             API Gateway  :4000
                    |
             Orchestrateur
         Planner · Memory · Permissions
                    |
         Employés IA · Swarm · Audit
                    |
              ATLAS Connect
```

Le modèle de données suit le cahier des charges : `User`, `Organization`, `Department`, `Agent`, `Workflow`, `Task`, `Conversation`, `Document`, `Integration`, `Meeting`, `Decision`, `AuditLog`. Il vit dans `packages/domain`. Les contrats HTTP partagés sont dans `packages/contracts`.

## Décisions d’architecture

- Une passerelle HTTP unique. L’orchestrateur est une bibliothèque derrière elle, avec une frontière nette pour le séparer plus tard.
- Le planner actuel pose l’organigramme du scénario hackathon (CTO, CMO, Sales, Finance, Legal, Developer, QA). Un planner branché sur un modèle de langage le remplace sans changer la passerelle.
- Les permissions sont une fonction pure : autorisé, approbation du CEO, ou refus. Un plafond de dépense (500 € pour le CMO) force l’Approval Center.
- La mémoire d’une organisation est enregistrée après chaque changement. Avec `DATABASE_URL`, elle vit dans PostgreSQL (utilisateurs, organisations, agents, tâches, messages, décisions). Sans cette variable, elle reste dans le conteneur Blob `atlas-organizations` si `AZURE_STORAGE_CONNECTION_STRING` est défini, sinon dans `data/atlas-state.json`.
- Le temps réel est un flux SSE : `GET /v1/organizations/:id/events`.
- Jarvis est le canal du CEO, mains libres. Mot d’éveil `jarvis`, français. Le pipeline est écoute, intention, action, voix. Il couvre le briefing, les tâches, les décisions, les réunions, l’équipe, la charge, les outils et la composition d’une organisation. `POST /v1/jarvis`.
- Les connecteurs répondent « non connecté » tant qu’aucun secret n’est fourni.
- Mootion (`api.seedv.cn`, texte vers vidéo) est le canal de synthèse d’avatar. Sans `MOOTION_API_TOKEN`, le briefing reste du texte.
- osa-gallery est la réserve d’avatars CC0. pixel3dmm et Genesis OS ne sont pas dans le runtime.

## Lancer

```bash
npm install
npm test
npm run dev:gateway
npm run dev:web
npm run dev:mobile
```

- Studio : http://localhost:3000
- Passerelle : http://localhost:4000/health

Copier `.env.example` vers `.env` avant le premier lancement. `ATLAS_DEV_USER` identifie le CEO en local.

## Cloud Azure

Les organisations créées par les utilisateurs sont faites pour rester allumées. La passerelle tourne dans Azure Container Apps avec au moins une instance. Les comptes, agents, rôles, mémoire, permissions, connaissances et outils sont écrits dans Azure Database for PostgreSQL.

```powershell
az login
./infra/azure/deploy.ps1
```

Le script crée le groupe `rg-atlas` en France Central, le compte de stockage, puis la passerelle si Docker est disponible. La chaîne de connexion est posée dans le secret du conteneur, pas dans le dépôt.
