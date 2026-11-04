---
title: "Regionsanfragen"
description: "NimbusNexus bitten, eine Region zu eröffnen, die es noch nicht bedient."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Regionsanfragen

Eine angemeldete Sitzung kann jede Region nutzen, die NimbusNexus bedient: `GET /api/v1/account/datacenters` listet sie auf, und `GET /api/v1/account/rescope?region=<region_name>` wechselt in eine davon (siehe [Kontoübersicht](/docs/api/account-overview)). Eine Regionsanfrage gilt einem Ort, den NimbusNexus noch nicht bedient. Damit sagen Sie uns, wo wir als Nächstes eröffnen sollen.

Eine Regionsanfrage ändert keine Kontingente. Um ein Limit zu erhöhen, senden Sie eine Kontingentanfrage mit `POST /api/v1/quota-request/` (siehe [Kontingente](/docs/api/quotas)).

`POST /api/v1/account/region-requests` steht hinter dem Formular „Region anfragen“ auf der Website von NimbusNexus und braucht deshalb keine Anmeldung. Senden Sie eine `email` und einen `regionCode`: einen der Codes `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` und `jnb` oder `__other` mit dem Ort in `regionOtherText`. `company` und `note` sind optional. Die Antwort ist nur `success`: Nichts wird genehmigt oder freigeschaltet. Wir zählen die Anfragen, um zu sehen, wo Nachfrage besteht.

## Nächste Schritte {#next-steps}

- [Regionen](/docs/api/regions) — die Liste der verfügbaren Regionen.
- [Kontingente](/docs/api/quotas) — wie Sie ein höheres Limit beantragen.
- [Kontoübersicht](/docs/api/account-overview) — der Kontokontext für den Regionszugriff.
