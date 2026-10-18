<?php
/**
 * Pont ZTC → ATLAS LLM (FOSSBilling / hooks PHP).
 * Copier dans le code ZTC. Les secrets restent en variables d’environnement.
 *
 * ATLAS_URL=http://localhost:3000
 * ATLAS_BRIDGE_TOKEN=   (même valeur que ZTC_BRIDGE_TOKEN côté ATLAS)
 */
function atlas_url(): string {
    return rtrim(getenv('ATLAS_URL') ?: 'http://localhost:3000', '/');
}

function atlas_headers(): array {
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $token = getenv('ATLAS_BRIDGE_TOKEN') ?: '';
    if ($token !== '') $headers[] = 'Authorization: Bearer ' . $token;
    return $headers;
}

function atlas_post(array $body): array {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", atlas_headers()),
            'content' => json_encode($body),
            'timeout' => 60,
        ],
    ]);
    $raw = @file_get_contents(atlas_url() . '/api/atlas/ztc/connect', false, $context);
    if ($raw === false) return ['ok' => false, 'error' => 'ATLAS injoignable'];
    $json = json_decode($raw, true);
    return is_array($json) ? $json : ['ok' => false, 'error' => 'réponse invalide'];
}

/** Un bureau ATLAS (Nova, Radar, Swift, Flare…) pense avec les données live du rôle. */
function atlas_think(string $desk, string $text): array {
    return atlas_post(['op' => 'think', 'desk' => $desk, 'text' => $text]);
}

/** Pousse un fait observé (prix, ticket, santé). Jamais une estimation. */
function atlas_ingest(string $desk, string $source, array $facts): array {
    return atlas_post(['op' => 'ingest', 'desk' => $desk, 'source' => $source, 'facts' => $facts]);
}
