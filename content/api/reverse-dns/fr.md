---
title: "DNS inverse (enregistrements PTR)"
description: "Enregistrements PTR des IP flottantes — le nom d’hôte obtenu par résolution inverse de votre IP."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: reverse-dns
---

# DNS inverse (enregistrements PTR)

Le DNS inverse, c’est le nom d’hôte qu’obtient quelqu’un qui demande « quel est le nom derrière cette IP ? » — l’inverse de la résolution DNS normale. Les enregistrements vivent dans une arborescence distincte (`in-addr.arpa.` pour IPv4, `ip6.arpa.` pour IPv6) et font autorité pour le bloc d’IP qu’ils couvrent.

Pour la plupart des VM, le DNS inverse par défaut convient. Définissez un PTR personnalisé quand :

- **Vous exploitez un serveur de messagerie.** La plupart des grands fournisseurs de messagerie rejettent le courrier provenant d’IP dont le PTR ne correspond pas au DNS direct du nom d’hôte d’envoi. Sans PTR correspondant, votre taux de livraison tombe à zéro.
- **Un partenaire vous autorise sur la base d’une identification par PTR.** Certains pare-feu vérifient le trafic TCP entrant par une recherche inverse suivie d’une recherche directe.

Il y a deux façons d’en définir un :

- **Sur une [IP flottante](/docs/api/floating-ips).** `PUT /api/v1/ptr/records/set/{floatingip_id}` définit ou remplace son PTR, avec le nom d’hôte cible dans `ptrdname` ; `PUT /api/v1/ptr/records/unset/{floatingip_id}` le supprime. L’ID a la forme `<region>:<floating-ip-id>`.
- **Dans une zone inverse qui appartient à votre projet.** `POST /api/v1/zones/{zone_id}/ptr/` ajoute un jeu d’enregistrements PTR pour une `ip`, avec le nom d’hôte cible dans `records`.

## Étapes suivantes {#next-steps}

- [IP flottantes](/docs/api/floating-ips) — les allocations d’IP sur lesquelles se définissent les PTR.
- [Zones DNS](/docs/api/dns-zones) et [Enregistrements DNS](/docs/api/dns-records) — le côté DNS direct.
