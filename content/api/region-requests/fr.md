---
title: "Demandes de région"
description: "Demandez à NimbusNexus d’ouvrir une région qu’il ne dessert pas encore."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Demandes de région

Une session connectée peut utiliser n’importe quelle région que dessert NimbusNexus : `GET /api/v1/account/datacenters` les liste, et `GET /api/v1/account/rescope?region=<region_name>` bascule vers l’une d’elles (voir [Vue d’ensemble du compte](/docs/api/account-overview)). Une demande de région concerne un endroit que NimbusNexus ne dessert pas encore. Elle nous indique où vous aimeriez que nous ouvrions ensuite.

Une demande de région ne modifie pas les quotas. Pour relever une limite, envoyez une demande de quota avec `POST /api/v1/quota-request/` (voir [Quotas](/docs/api/quotas)).

`POST /api/v1/account/region-requests` sert de backend au formulaire « demander une région » du site web NimbusNexus : il ne nécessite donc aucune connexion. Envoyez un `email` et un `regionCode` : l’un de `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` ou `jnb`, ou bien `__other` avec le lieu dans `regionOtherText`. `company` et `note` sont facultatifs. La réponse se limite à `success` : rien n’est approuvé ni accordé. Nous comptons les demandes pour voir où se concentrent les besoins.

## Étapes suivantes {#next-steps}

- [Régions](/docs/api/regions) — la liste des régions disponibles.
- [Quotas](/docs/api/quotas) — comment demander une limite plus élevée.
- [Vue d’ensemble du compte](/docs/api/account-overview) — le contexte du compte pour l’accès aux régions.
