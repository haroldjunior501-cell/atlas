import assert from 'node:assert/strict'
import test from 'node:test'
import { atlasGreeting, directiveFromModel, interpretAtlas, localVoiceReply, speechLang, wantsAdoption, youtubeSearchUrl } from './atlas-voice'
import { rankBySimilarity, translateInstruction, unsafeVerdict } from './nvidia-voice'

test('l’accueil vocal salue par le nom inscrit', () => {
  assert.equal(atlasGreeting('Harold Martin'), 'Salut Harold Martin, que puis-je faire pour toi ?')
  assert.equal(atlasGreeting('  '), 'Salut, que puis-je faire pour toi ?')
})
test('Nemotron renvoie une action du studio', () => {
  const directive = directiveFromModel('{"reply":"J’ouvre les missions.","action":{"kind":"navigate","view":"missions"}}')
  assert.equal(directive?.action.kind, 'navigate')
  assert.equal(directiveFromModel('pas du json'), null)
})

test('une phrase d’organisation compose l’équipe', () => {
  const action = interpretAtlas('Jarvis, monte une équipe cybersécurité pour des PME')
  assert.equal(action.kind, 'compose')
  if (action.kind === 'compose') assert.match(action.text, /cybersécurité/)
})

test('les ordres de studio ne créent pas une organisation', () => {
  assert.deepEqual(interpretAtlas('Atlas, ouvre les missions'), { kind: 'navigate', view: 'missions' })
  assert.deepEqual(interpretAtlas('mode avancé'), { kind: 'mode', advanced: true })
  assert.equal(interpretAtlas('approuve').kind, 'approve')
  assert.equal(interpretAtlas('montre l’équipe').kind, 'team')
  assert.equal(interpretAtlas('utilise le modèle SaaS').kind, 'template')
  assert.equal(interpretAtlas('ajoute un département juridique').kind, 'department')
  assert.equal(interpretAtlas('déplace Sarah vers Marketing').kind, 'move')
})

test('ATLAS pilote le Bureau 3D et les factures', () => {
  assert.deepEqual(interpretAtlas('Atlas, ouvre le bureau 3D'), { kind: 'navigate', view: 'bureau' })
  assert.deepEqual(interpretAtlas('montre les factures'), { kind: 'navigate', view: 'factures' })
  assert.deepEqual(interpretAtlas('relance les factures en retard'), { kind: 'orchestrate', scope: 'relance' })
  assert.deepEqual(interpretAtlas('envoie les brouillons de facture'), { kind: 'orchestrate', scope: 'envoi' })
  assert.deepEqual(interpretAtlas('Atlas, orchestre le bureau'), { kind: 'orchestrate', scope: 'all' })
  assert.equal(interpretAtlas('ouvre le bureau').kind, 'invoke')
})

test('ATLAS contrôle les zones, les postes, les outils et le suivi des agents', () => {
  assert.deepEqual(interpretAtlas('Atlas, ajoute une salle de réunion'), { kind: 'space', op: 'add', target: 'meeting_medium', name: undefined })
  assert.deepEqual(interpretAtlas('crée un atelier appelé Carrosserie'), { kind: 'space', op: 'add', target: 'workshop', name: 'Carrosserie' })
  assert.deepEqual(interpretAtlas('ajoute un bureau'), { kind: 'space', op: 'add', target: 'private_office', name: undefined })
  assert.deepEqual(interpretAtlas('supprime le poste de comptable'), { kind: 'space', op: 'remove', target: 'poste de comptable' })
  assert.deepEqual(interpretAtlas('supprime la cafétéria'), { kind: 'space', op: 'remove', target: 'cafétéria' })
  assert.deepEqual(interpretAtlas('supprime le département juridique'), { kind: 'space', op: 'remove', target: 'département juridique' })
  assert.deepEqual(interpretAtlas('embauche un mécanicien dans l’atelier'), { kind: 'hire', role: 'Mécanicien', department: 'Atelier' })
  assert.deepEqual(interpretAtlas('recrute un comptable'), { kind: 'hire', role: 'Comptable' })
  assert.deepEqual(interpretAtlas('connecte Léa à Gmail'), { kind: 'equip', name: 'Léa', provider: 'gmail', on: true })
  assert.deepEqual(interpretAtlas('donne à noah l’accès à Slack'), { kind: 'equip', name: 'Noah', provider: 'slack', on: true })
  assert.deepEqual(interpretAtlas('retire Slack à Noah'), { kind: 'equip', name: 'Noah', provider: 'slack', on: false })
  assert.deepEqual(interpretAtlas('où en est Léa'), { kind: 'follow', name: 'Léa' })
  assert.equal(interpretAtlas('licencie Léa').kind, 'fire')
  assert.equal(interpretAtlas('supprime cette organisation').kind, 'clear_org')
  assert.equal(interpretAtlas('ajoute un département juridique').kind, 'department')
  assert.notEqual(interpretAtlas('crée une agence de marketing à Lausanne').kind, 'space')
  assert.notEqual(interpretAtlas('supprime la réunion de demain').kind, 'space')
  assert.equal(interpretAtlas('où en est l’équipe').kind, 'brief')
  assert.deepEqual(interpretAtlas('Atlas, lance une mission d’équipe : je lance une marque de café, analyse 5 concurrents et fais un site'), { kind: 'crew', mission: 'je lance une marque de café, analyse 5 concurrents et fais un site' })
  assert.equal(interpretAtlas('monte une équipe pour comparer trois logiciels de facturation').kind, 'crew')
  assert.equal(interpretAtlas('analyse 4 concurrents de notre boutique').kind, 'crew')
})

test('la recherche, le dossier, la tâche et la réunion entre agents sont des ordres', () => {
  assert.equal(interpretAtlas('cherche sur internet la cybersécurité des PME').kind, 'search')
  const videos = interpretAtlas('recherche moi les vidéo de comment crée une bonne entreprise')
  assert.equal(videos.kind, 'videos')
  if (videos.kind === 'videos') assert.match(videos.query, /comment cr[eé]e une bonne entreprise/i)
  assert.equal(interpretAtlas('cherche des vidéos sur youtube comment monter une startup').kind, 'videos')
  assert.equal(interpretAtlas('que dit le dossier sur le budget').kind, 'knowledge')
  const meeting = interpretAtlas('planifie une réunion entre Marc et Sarah sur le budget')
  assert.equal(meeting.kind, 'meeting')
  if (meeting.kind === 'meeting') assert.deepEqual(meeting.with, ['Marc', 'Sarah'])
  assert.equal(interpretAtlas('lance une tâche prépare le reporting').kind, 'mission')
})

test('un appel vide ne fait qu’écouter', () => {
  assert.equal(interpretAtlas('Atlas').kind, 'listen')
  assert.equal(interpretAtlas('bonjour').kind, 'listen')
})

test('supprimer l’organigramme et toute demande libre', () => {
  assert.equal(interpretAtlas('Supprime cette organigramme').kind, 'clear_org')
  assert.equal(interpretAtlas('efface l’organisation').kind, 'clear_org')
  assert.equal(interpretAtlas('retiens que je préfère le tutoiement').kind, 'remember')
  const free = interpretAtlas('comment trouver des clients pour vendre en ligne sans budget')
  assert.equal(free.kind, 'answer')
  if (free.kind === 'answer') assert.match(free.text, /clients|budget|ligne/i)
})

test('une question pédagogique ou code devient un ordre partenaire', () => {
  assert.ok(['listen', 'answer'].includes(interpretAtlas('bonjour, comment vas-tu ?').kind))
  const teach = interpretAtlas('explique-moi la cybersécurité')
  assert.equal(teach.kind, 'teach')
  if (teach.kind === 'teach') assert.equal(teach.style, 'explain')
  assert.equal(interpretAtlas('what is a firewall').kind, 'teach')
  assert.equal(interpretAtlas('retiens que je préfère le tutoiement').kind, 'remember')
  assert.equal(interpretAtlas('que sais-tu de moi').kind, 'recall')
  assert.equal(interpretAtlas('oublie mon ancien numéro').kind, 'forget')
  assert.equal(interpretAtlas('cherche une alternance marketing digital').kind, 'research')
  assert.equal(interpretAtlas('génère un hook React').kind, 'code')
  assert.equal(interpretAtlas('rédige un rapport de stage').kind, 'draft')
  const extract = interpretAtlas('extrais les dates du fichier Orelle')
  assert.equal(extract.kind, 'extract')
  if (extract.kind === 'extract') {
    assert.equal(extract.focus, 'dates')
    assert.equal(extract.source, 'Orelle')
  }
  const transform = interpretAtlas('transforme le fichier Brief en markdown et sauvegarde comme BriefMd')
  assert.equal(transform.kind, 'transform')
  if (transform.kind === 'transform') {
    assert.equal(transform.op, 'markdown')
    assert.equal(transform.source, 'Brief')
    assert.equal(transform.saveAs, 'BriefMd')
  }
  assert.equal(interpretAtlas('corrige ce texte').kind, 'transform')
  assert.equal(interpretAtlas('corrige ce code React').kind, 'code')
  assert.equal(speechLang('What is a firewall?'), 'en-US')
  assert.equal(speechLang('Bonjour, comment puis-je vous aider ?'), 'fr-FR')
  assert.equal(speechLang('Hola, ¿cómo estás?'), 'es-ES')
  assert.equal(speechLang('こんにちは、アトラスです。'), 'ja-JP')
  assert.equal(speechLang('Привет, как дела?'), 'ru-RU')
})

test('une question ne crée pas une organisation', () => {
  assert.notEqual(interpretAtlas('bonjour, comment vas-tu ?').kind, 'compose')
  assert.notEqual(interpretAtlas('what is a firewall').kind, 'compose')
  assert.notEqual(interpretAtlas('explique-moi la cybersécurité').kind, 'compose')
})

test('les sept familles d’ordres du dirigeant', () => {
  assert.equal(interpretAtlas('qu’est-ce qui se passe aujourd’hui').kind, 'brief')
  assert.equal(interpretAtlas('crée un département juridique').kind, 'department')
  const mission = interpretAtlas('demande à Sarah de préparer la campagne')
  assert.equal(mission.kind, 'mission')
  if (mission.kind === 'mission') assert.match(mission.text, /Sarah/)
  const freedom = interpretAtlas('donne plus d’autonomie à Emma')
  assert.deepEqual(freedom, { kind: 'autonomy', name: 'Emma', level: 'autonomous' })
  const pair = interpretAtlas('connecte Sarah et Alex')
  assert.equal(interpretAtlas('prépare une campagne marketing').kind, 'workflow')
  assert.equal(interpretAtlas('pourquoi nos ventes ont baissé').kind, 'knowledge')
  assert.equal(interpretAtlas('crée une startup de cybersécurité').kind, 'compose')
  assert.equal(interpretAtlas('crée un SaaS B2B de cybersécurité en abonnement').kind, 'compose')
})

test('une commande composée devient une mission répartie', () => {
  const action = interpretAtlas('Sarah, analyse notre marché, demande à Thomas d’identifier 50 prospects et demande à Emma de vérifier si nous avons le budget. Ensuite, fais-moi un résumé.')
  assert.equal(action.kind, 'plan')
  if (action.kind === 'plan') {
    assert.deepEqual(action.steps.map((step) => step.name), ['Sarah', 'Thomas', 'Emma'])
    assert.match(action.steps[1].task, /50 prospects/)
    assert.equal(action.summary, true)
  }
})

test('on parle directement à un employé, et on le fait entrer', () => {
  assert.deepEqual(interpretAtlas('Sarah, explique-moi ta stratégie'), { kind: 'ask', name: 'Sarah', question: 'explique-moi ta stratégie' })
  assert.deepEqual(interpretAtlas('demande à Sarah de rejoindre la conversation'), { kind: 'ask', name: 'Sarah', question: '' })
  assert.ok(['listen', 'answer'].includes(interpretAtlas('Bonjour, comment vas-tu ?').kind))
  const meeting = interpretAtlas('organise une réunion avec Sarah, Alex et Emma pour préparer le lancement')
  assert.equal(meeting.kind, 'meeting')
  if (meeting.kind === 'meeting') {
    assert.deepEqual(meeting.with, ['Sarah', 'Alex', 'Emma'])
    assert.match(meeting.title, /lancement/i)
  }
})

test('la recherche vidéo ouvre YouTube sans composer une organisation', () => {
  const action = interpretAtlas('recherche moi les vidéo de comment crée une bonne entreprise')
  assert.equal(action.kind, 'videos')
  if (action.kind === 'videos') {
    assert.match(action.query, /comment cr[eé]e une bonne entreprise/i)
    assert.match(youtubeSearchUrl(action.query), /youtube\.com\/results\?search_query=/)
  }
  const model = directiveFromModel('{"reply":"J’ouvre YouTube.","action":{"kind":"videos","query":"créer une entreprise"}}')
  assert.equal(model?.action.kind, 'videos')
})

test('la recherche web, le mail, l’app, le post et l’employé sont des ordres', () => {
  assert.equal(interpretAtlas('cherche la cybersécurité des PME').kind, 'search')
  const market = interpretAtlas('faire des recherche sur les meilleur produit que nous allons vendre et adopte les')
  assert.ok(market.kind === 'search' || market.kind === 'research')
  if (market.kind === 'search' || market.kind === 'research') {
    assert.match(market.query, /produit|vendre/i)
    assert.doesNotMatch(market.query, /^faire des recherche/i)
  }
  assert.equal(wantsAdoption('faire des recherche sur les produits et adopte les'), true)
  const orelle = interpretAtlas('crée un fichier et norme le Orelle')
  assert.equal(orelle.kind, 'invoke')
  if (orelle.kind === 'invoke') {
    assert.equal(orelle.provider, 'filesystem')
    assert.equal(orelle.tool, 'create_document')
    const payload = JSON.parse(orelle.input) as { title: string; body: string }
    assert.equal(payload.title, 'Orelle')
    assert.equal(payload.body, '')
  }
  const withBody = interpretAtlas('crée un fichier nommé Brief et écris dedans Bonjour équipe')
  if (withBody.kind === 'invoke') {
    const payload = JSON.parse(withBody.input) as { title: string; body: string }
    assert.equal(payload.title, 'Brief')
    assert.match(payload.body, /Bonjour équipe/i)
  }
  assert.equal(interpretAtlas('lis mes mails').kind, 'mail')
  assert.equal(interpretAtlas('lie mon dernier mail').kind, 'mail')
  assert.equal(interpretAtlas('lit mon dernier mail').kind, 'mail')
  assert.equal(interpretAtlas('montre mon dernier mail').kind, 'mail')
  assert.equal(interpretAtlas('mon dernier mail').kind, 'mail')
  assert.notEqual(interpretAtlas('relie Gmail').kind, 'mail')
  const slack = interpretAtlas('télécharge slack')
  assert.equal(slack.kind, 'install')
  if (slack.kind === 'install') assert.equal(slack.provider, 'slack')
  const post = interpretAtlas('publie un post sur linkedin pour le lancement')
  assert.equal(post.kind, 'post')
  if (post.kind === 'post') assert.equal(post.channel, 'LinkedIn')
  assert.equal(interpretAtlas('crée un workflow pour relancer les clients').kind, 'workflow')
  assert.equal(interpretAtlas('crte moi un workflow').kind, 'workflow')
  assert.equal(interpretAtlas('crée moi un workflow').kind, 'workflow')
  assert.deepEqual(interpretAtlas('parle à Sarah de la stratégie'), { kind: 'ask', name: 'Sarah', question: 'la stratégie' })
  assert.equal(interpretAtlas('connecte gmail').kind, 'connect')
  const gmail = interpretAtlas('relie Gmail')
  assert.equal(gmail.kind, 'connect')
  if (gmail.kind === 'connect') {
    assert.equal(gmail.provider, 'gmail')
    assert.equal(gmail.url, undefined)
  }
  const n8n = interpretAtlas('relie n8n sur https://n8n.example/mcp')
  assert.equal(n8n.kind, 'connect')
  if (n8n.kind === 'connect') assert.equal(n8n.provider, 'n8n')
  assert.equal(interpretAtlas('envoie un mail au client').kind, 'invoke')
  const replyMail = interpretAtlas('réponds au dernier mail en confirmant le rendez-vous')
  assert.equal(replyMail.kind, 'invoke')
  if (replyMail.kind === 'invoke') {
    assert.equal(replyMail.provider, 'gmail')
    assert.equal(replyMail.tool, 'prepare_reply')
  }
  const sendMail = interpretAtlas('envoie un mail à sarah@entreprise.com sujet : Confirmation')
  assert.equal(sendMail.kind, 'invoke')
  if (sendMail.kind === 'invoke') assert.equal(sendMail.tool, 'send_email')
  assert.equal(interpretAtlas('connecte Sarah et Alex').kind, 'collaborate')
})

test('une question sans modèle reste une réponse d’Atlas', () => {
  assert.match(localVoiceReply('Bonjour, comment vas-tu ?'), /(Ça va bien|Je vais bien)/)
  assert.doesNotMatch(localVoiceReply('bonjour'), /occupé/)
})

test('la sécurité, la traduction et le retriever ont une forme exploitable', () => {
  assert.equal(unsafeVerdict('User Safety: safe'), false)
  assert.equal(unsafeVerdict('User Safety: unsafe'), true)
  assert.match(translateInstruction('English', 'Bonjour'), /English/)
  const ranked = rankBySimilarity([1, 0], [
    { name: 'loin', vector: [0, 1] },
    { name: 'proche', vector: [0.9, 0.1] },
  ])
  assert.equal(ranked[0], 'proche')
})

test('générer une vidéo lance le film, pas YouTube', () => {
  const action = interpretAtlas('Génère une vidéo cinématographique d’un cygne sur un lac à l’aube')
  assert.equal(action.kind, 'film')
  if (action.kind === 'film') assert.match(action.prompt, /cygne/i)
  assert.equal(interpretAtlas('cherche des vidéos de cygnes').kind, 'videos')
  const model = directiveFromModel('{"reply":"Je tourne le film.","action":{"kind":"film","prompt":"a swan at dawn"}}')
  assert.equal(model?.action.kind, 'film')
})
