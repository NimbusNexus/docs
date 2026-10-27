---
title: "Webhooks de la plateforme"
description: "Abonnez-vous aux événements de cycle de vie de votre infrastructure. Des POST signés en HMAC vers une URL que vous contrôlez."
publishedAt: 2026-05-20
updatedAt: 2026-08-05
kind: concept
---

# Webhooks de la plateforme

Les webhooks de la plateforme sont le moyen par lequel NimbusNexus informe vos systèmes quand quelque chose change — une VM termine son provisionnement, un snapshot se termine, une facture est générée. Vous enregistrez une URL ; nous lui envoyons en POST un payload JSON à chaque déclenchement de l’événement correspondant.

> **Vous cherchez le produit Webhooks ?** Si vous voulez envoyer des webhooks à *vos propres* clients — publier un événement et nous laisser signer, réessayer et rejouer chaque livraison — c’est un produit distinct, documenté dans [Webhooks (produit)](/docs/product-webhooks). Cette page ne couvre que les notifications que NimbusNexus *vous* envoie au sujet de votre propre infrastructure. **Les deux utilisent des headers de signature différents** : le code de vérification n’est donc pas interchangeable.

Les webhooks vous permettent de réagir aux changements d’état sans polling. Le polling fonctionne, mais il gaspille des ressources à grande échelle (la plupart des requêtes répondent « rien n’a changé ») et il est lent à petite échelle (vous n’apprenez un changement qu’au prochain tour de polling). Les webhooks inversent le modèle — nous vous prévenons dès que quelque chose se produit.

## À quoi ressemble une livraison {#delivery}

```http
POST /webhooks/nimbusnexus HTTP/1.1
Host: your-app.example.com
Content-Type: application/json
NN-Event: vm.created
NN-Delivery-Id: del_01HG7Y3...
NN-Timestamp: 1763410800
NN-Signature: sha256=4d2c8f19e6b07d3f...

{
  "event": "vm.created",
  "occurred_at": "2026-05-20T18:30:00Z",
  "data": {
    "id": "vm_01HG7Y3...",
    "name": "web-01",
    "state": "running",
    "ipv4": "203.0.113.5"
  }
}
```

Chaque livraison porte quatre headers :

- `NN-Event` — le type d’événement (`vm.created`, `snapshot.completed`, etc.)
- `NN-Delivery-Id` — unique pour chaque livraison ; vous pouvez l’utiliser sans risque comme clé d’idempotence de votre côté
- `NN-Timestamp` — l’heure de la livraison en secondes epoch Unix ; utilisé dans la signature
- `NN-Signature` — HMAC-SHA256 sur `{timestamp}.{body}`, encodé en hexadécimal

## Vérifier la signature {#signature}

La signature prouve que la livraison vient de NimbusNexus, et non de quelqu’un qui aurait deviné l’URL de votre webhook. Vérifiez-la dans votre handler avant tout traitement :

```ts
import crypto from 'node:crypto'

function verifyWebhook(req: Request, secret: string): boolean {
  const timestamp = req.headers.get('NN-Timestamp')!
  const signature = req.headers.get('NN-Signature')!.replace(/^sha256=/, '')
  const body = req.bodyText // raw body, not parsed JSON

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  // Constant-time compare avoids timing oracles
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
```

Le secret vient de la console, au moment de la création de l’endpoint de webhook. Stockez-le dans votre gestionnaire de secrets, pas dans le code source — il permet à n’importe qui de falsifier des livraisons.

Rejetez aussi les livraisons dont le timestamp s’écarte de plus de 5 minutes de l’horloge de votre serveur. Cela borne la fenêtre de rejeu si le secret venait à fuiter.

## Types d’événements {#events}

Chaque ressource qui a un cycle de vie émet des événements. Les plus courants :

| Événement | Quand |
|---|---|
| `vm.created` | Une VM a terminé son provisionnement et est `running` |
| `vm.state_changed` | Une VM est passée d’un état à un autre, quels qu’ils soient |
| `vm.deleted` | Une VM a été détruite |
| `snapshot.completed` | Un snapshot a fini d’être copié |
| `backup.completed` | Une sauvegarde planifiée s’est terminée |
| `database.upgrade_completed` | Une mise à jour du moteur d’une base de données managée s’est terminée |
| `floating_ip.attached` / `floating_ip.detached` | Changements de rattachement |
| `invoice.generated` | Une facture mensuelle a été finalisée |
| `payment.succeeded` / `payment.failed` | Résultats de paiement |
| `quota.warning` | Le projet a dépassé 90 % de l’un de ses quotas |

La liste complète des types d’événements se trouve dans la référence de l’API de chaque ressource (le champ `events` de la ressource indique ce qui est émis).

## Sémantique de livraison {#delivery-semantics}

- **Au moins une fois.** Un réseau instable ou un handler lent peut nous amener à réessayer. Utilisez `NN-Delivery-Id` pour dédupliquer de votre côté.
- **L’ordre n’est pas garanti.** Deux événements déclenchés à ~1 seconde d’intervalle peuvent arriver dans le désordre. Le champ `occurred_at` du payload indique l’ordre réel ; triez dessus si cela compte.
- **Réessais :** les livraisons échouées (réponse non-2xx, ou timeout > 10 s) sont réessayées avec un backoff exponentiel à 1, 5, 25, 125 et 625 secondes. Cinq tentatives au total. Ensuite, la livraison est abandonnée ; nous l’affichons pendant 14 jours dans le panneau « failed deliveries » de la console.
- **Timeout :** votre handler a 10 secondes pour renvoyer un 2xx. Si vous devez faire plus de travail, mettez-le en file d’attente et accusez réception du webhook immédiatement.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — comment fonctionnent les clés API (et non les secrets de webhook).
- [Idempotence](/docs/idempotency) — le modèle que cette page recommande pour gérer les réessais.
- [Conventions](/docs/conventions) — formats d’erreur, codes de statut, le reste du format des requêtes.
