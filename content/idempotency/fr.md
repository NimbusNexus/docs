---
title: "Idempotence"
description: "Quelles routes acceptent le header Idempotency-Key, et comment réessayer sans risque sur les autres."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: concept
---

# Idempotence

Une requête est **idempotente** quand la faire deux fois a le même effet que la faire une fois. `GET /api/v1/instance/` est naturellement idempotente — elle ne change rien. `POST /api/v1/instance/` n’est naturellement **pas** idempotente — appelez-la deux fois et vous obtenez deux VM.

Le header `Idempotency-Key` rend une requête réessayable sans risque, mais seulement sur les quelques routes qui l’acceptent. Toutes les autres routes ignorent ce header.

## Le problème que cela résout {#problem}

Vous publiez un événement avec `POST /v1/events`. Le réseau coupe au retour, et vous obtenez un timeout au lieu d’un 201. L’événement est-il parti ? Vous ne le savez pas :

- Si vous réessayez : vos clients le reçoivent peut-être deux fois (la requête d’origine a réussi ; votre réessai en a publié un deuxième).
- Si vous ne réessayez pas : ils ne le reçoivent peut-être jamais (la requête d’origine a échoué ; vous avez accepté le mauvais état).

Avec une clé d’idempotence, le réessai est sans risque. Si la requête d’origine a réussi, le réessai renvoie l’événement d’origine et ne diffuse rien à nouveau. Si la requête d’origine a échoué, le réessai fait réellement le travail.

## Routes qui acceptent le header {#usage}

| Route | API | La clé est |
|---|---|---|
| `POST /v1/events` | Webhooks | Facultative |
| `POST /v1/qr-tracked/imports` | QR Codes | Obligatoire |
| `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` | Infrastructure | Obligatoire |

Envoyez n’importe quelle chaîne unique :

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Par convention, un UUID v4 par opération logique. Générez-le une fois côté client, enregistrez-le avant d’envoyer la requête et réutilisez-le à chaque réessai de cette même opération logique. Générez-en un nouveau pour l’opération logique *suivante*.

## Sur l’API Webhooks {#webhooks}

Sur l’API Webhooks, `Idempotency-Key` s’applique à la publication d’un événement (`POST /v1/events`) et se comporte ainsi :

| Vous envoyez | Vous obtenez |
|---|---|
| Une nouvelle clé | `201` et le nouvel événement, diffusé aux endpoints correspondants. |
| La même clé et le même corps | `200`, l’événement **d’origine** et le header `Idempotency-Replayed: true`. Rien n’est diffusé à nouveau. |
| La même clé et un corps différent | `409` avec `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` et la clé dans `details.idempotency_key`. L’événement d’origine est maintenu. |
| La même clé après une requête qui a échoué | La requête s’exécute de nouveau. Une publication qui échoue (une erreur de validation, une erreur de quota, une limite de débit) n’enregistre pas la clé. |

« Même corps » signifie le même type d’événement et le même payload pour le même projet. Une clé appartient à votre espace de travail et à votre projet, pas à la clé API qui l’a envoyée : deux clés API qui publient dans le même projet partagent donc les mêmes clés. Une clé est conservée au moins 24 heures.

## Sur QR Codes et lors de l’ajout de fonds {#other-routes}

Sur QR Codes, un import en masse (`POST /v1/qr-tracked/imports`) exige une clé. Une clé appartient à votre espace de travail. La même clé et le même corps renvoient l’import d’origine sans recréer ses codes ; la même clé et un corps différent renvoient `409`.

L’ajout de fonds à votre solde (`POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds`) exige aussi une clé, pour qu’une recharge réessayée ne débite pas la carte deux fois. Cet appel prend une session connectée, pas une clé API ([Moyens de paiement](/docs/api/payment-methods)).

## Conflit avec une utilisation précédente {#conflicts}

Sur Webhooks et QR Codes, si vous réutilisez une clé avec un **corps de requête différent** sur le même endpoint, vous obtenez `409 Conflict` avec `error.code: 'conflict'`, et `error.message` indique que la clé a déjà été utilisée avec un corps de requête différent. La requête d’origine est maintenue ; votre corps différent est rejeté. C’est le comportement le plus sûr — renvoyer silencieusement l’ancienne réponse masquerait un bug dans votre boucle de réessai.

Si vous devez vraiment faire une requête différente, générez une nouvelle clé.

Des versions antérieures de cette page indiquaient que cette réponse portait `error.code: 'idempotency_key_reused'`. L’API n’a jamais envoyé ce code ; elle envoie `conflict`. `conflict` couvre aussi d’autres conflits avec l’état existant, comme un nom déjà pris ; sur l’API Webhooks, `details.reason` vaut `idempotency_key_reuse` pour celui-ci. Voir [Erreurs](/docs/errors#codes-state).

## Sur toutes les autres routes {#skip}

Sans clé, vérifiez avant de réessayer une écriture :

- **Créer une VM ou un volume.** L’appel met le travail en file d’attente et répond sans identifiant : cherchez donc la nouvelle ressource dans la liste (`GET /api/v1/instance/`, `GET /api/v1/storage/`) avant de le relancer. Un `name` unique la rend facile à trouver.
- **Créer quelque chose avec un nom unique.** Pour une zone DNS ou un conteneur du stockage objet dont le nom est déjà pris, l’appel répond `409` : un réessai après un timeout ne peut donc pas créer de doublon. Voyez dans ce `409` le signe que la requête d’origine a peut-être réussi.
- **Supprimer.** Répéter une suppression ne supprime rien d’autre, même si le deuxième appel peut répondre par une erreur parce que la ressource n’existe déjà plus. Lisez la ressource pour en être sûr.

Pour les lectures, réessayer ne pose jamais de problème.

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — pagination, codes de statut, formats d’erreur, le reste.
- [Limitation de débit](/docs/rate-limiting) — quand les réessais tombent sur un 429, l’autre moitié de l’histoire du réessai sans risque.
- [Erreurs](/docs/errors) — le format des erreurs et ce que signifie chaque `error.code`.
