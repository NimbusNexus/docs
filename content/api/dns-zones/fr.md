---
title: "Zones DNS"
description: "Zones DNS faisant autorité, hébergées sur les serveurs de noms NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Zones DNS

Une zone DNS est un domaine faisant autorité, hébergé sur les serveurs de noms NimbusNexus. Créez une zone pour `example.com`, faites pointer votre registrar de domaine vers nos serveurs de noms, puis ajoutez des [enregistrements](/docs/api/dns-records) pour publier les adresses, le routage du courrier et les tokens de vérification de ce domaine.

## Délégation {#delegation}

Après la création d’une zone, la réponse contient les quatre serveurs de noms à configurer chez votre registrar :

```text
{{DNS_NS1}}
{{DNS_NS2}}
{{DNS_NS3}}
{{DNS_NS4}}
```

Définissez-les comme enregistrements NS de votre domaine chez votre registrar (GoDaddy, Cloudflare Registrar, Porkbun, etc.). Une fois la propagation terminée (en général de quelques minutes à quelques heures, selon les TTL du registrar), nos serveurs de noms font autorité pour le domaine.

Pendant une migration, vous pouvez continuer à utiliser votre fournisseur DNS actuel en parallèle — les enregistrements NS des deux fournisseurs peuvent coexister pendant une courte période si vous configurez le registrar pour utiliser les deux jeux ; retirez ensuite l’ancien jeu une fois tous les enregistrements déplacés.

## Zone ou sous-domaine {#zone-vs-subdomain}

Une zone = un domaine. `example.com` est une zone ; `api.example.com` est un sous-domaine géré par un enregistrement A ou CNAME dans la zone `example.com`, et non une zone distincte — sauf si vous voulez précisément déléguer `api.example.com` à un autre fournisseur DNS, auquel cas vous créeriez séparément `example.com` (avec des enregistrements NS qui pointent vers l’autre fournisseur pour le sous-domaine) et la zone du sous-domaine.

Pour un usage courant, une zone par domaine enregistré est la bonne structure.

## DNSSEC {#dnssec}

DNSSEC est activé par défaut sur chaque zone que nous hébergeons. Les enregistrements DS à publier chez votre registrar sont renvoyés dans l’objet de la zone et peuvent être récupérés de nouveau à tout moment. Nous faisons tourner la ZSK et la KSK tous les 90 jours ; chaque rotation de KSK nécessite une mise à jour du DS chez le registrar.

## Tarifs {#pricing}

- **Zones :** \$0.50 par zone et par mois.
- **Requêtes :** 1 million de requêtes/mois gratuites par zone, puis \$0.40 par million au-delà.

Pour comparaison : le DNS faisant autorité de Cloudflare est gratuit dans son offre de base, Route 53 coûte \$0.50/zone + un tarif par requête, AWS Cloud Map est plus cher. Nos tarifs nous placent entre Cloudflare et Route 53.

## Étapes suivantes {#next-steps}

- [Enregistrements DNS](/docs/api/dns-records) — les enregistrements d’une zone.
- [IP flottantes](/docs/api/floating-ips) — cible typique d’un enregistrement A ou AAAA.
- [Load balancers](/docs/api/load-balancers) — une autre cible typique d’un enregistrement.
