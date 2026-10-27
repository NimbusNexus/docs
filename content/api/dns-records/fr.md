---
title: "Enregistrements DNS"
description: "Enregistrements A, AAAA, CNAME, MX, TXT, SRV et NS d’une zone."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Enregistrements DNS

Un jeu d’enregistrements est un tuple `(name, type)` dans une [zone](/docs/api/dns-zones), qui contient une ou plusieurs valeurs. `www.example.com → A → 203.0.113.5` est un jeu d’enregistrements A à valeur unique ; les jeux multivaleurs (DNS round-robin) contiennent N valeurs sous un seul identifiant de jeu.

## Types d’enregistrements pris en charge {#types}

| Type | Usage | Exemple de valeur |
| --- | --- | --- |
| **A** | Adresse IPv4 | `203.0.113.5` |
| **AAAA** | Adresse IPv6 | `2001:db8::1` |
| **CNAME** | Alias vers un autre nom | `other.example.com.` |
| **MX** | Serveur de messagerie | `10 mail.example.com.` |
| **TXT** | Texte libre — vérification, SPF, DKIM, DMARC | `"v=spf1 -all"` |
| **SRV** | Emplacement d’un service | `10 5 5060 sip.example.com.` |
| **NS** | Délégation vers d’autres serveurs de noms | `ns1.other.com.` |
| **CAA** | Autorisation des autorités de certification | `0 issue "letsencrypt.org"` |
| **PTR** | Pointeur de DNS inverse (pour les IP flottantes) | Voir les [IP flottantes](/docs/api/floating-ips) |

Nous ne prenons pas en charge : `ALIAS` / `ANAME` (aplatissement de CNAME à l’apex) — utilisez plutôt le CNAME sur un sous-domaine, ou à l’apex un enregistrement A qui pointe vers une IP flottante.

## Enregistrements multivaleurs {#multi-value}

Vous pouvez mettre plusieurs valeurs dans un même jeu d’enregistrements :

```text
www.example.com → A → 203.0.113.5
                  → 203.0.113.6
                  → 203.0.113.7
```

Les serveurs de noms renvoient les trois valeurs à chaque requête, et les résolveurs répartissent les requêtes entre elles — un équilibrage de charge round-robin basique, sans LB. Pour un véritable équilibrage de charge, faites plutôt pointer l’enregistrement vers la VIP d’un [load balancer](/docs/api/load-balancers) ; le multivaleur convient aux cas où le client et le résolveur gèrent eux-mêmes le basculement (la plupart des clients HTTP modernes en sont capables).

## TTL {#ttl}

Chaque jeu d’enregistrements a un TTL en secondes — la durée pendant laquelle les résolveurs gardent la réponse en cache avant de refaire la requête. Valeurs par défaut :

- **A / AAAA / CNAME :** 300 secondes (5 minutes) — adapté aux mises à jour rapides / au basculement
- **MX / NS :** 3600 (1 heure) — ils changent rarement
- **TXT de vérification :** 60 — court, pour que les nouvelles vérifications soient rapides

Choisissez des TTL plus bas tant que vous itérez activement ; augmentez-les une fois les enregistrements stabilisés, pour réduire le volume de requêtes et le coût.

## Étapes suivantes {#next-steps}

- [Zones DNS](/docs/api/dns-zones) — le conteneur dans lequel vivent les enregistrements.
- [IP flottantes](/docs/api/floating-ips) — cible A/AAAA courante.
- [Load balancers](/docs/api/load-balancers) — cible VIP pour les services à plus fort trafic.
