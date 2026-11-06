---
title: "API-Referenz"
description: "Jede Operation jedes NimbusNexus-Produkts, Apps und Infrastruktur, mit dem REST-Aufruf und dem SDK-Aufruf in der Sprache, die Sie wählen."
publishedAt: 2026-10-19
updatedAt: 2026-11-06
kind: reference
---

# API-Referenz

Jedes NimbusNexus-Produkt ist eine REST-API, und jede Operation ist hier aufgeführt. Apps sind die verwalteten Produkte, die Sie aus Ihrem Code aufrufen: Webhooks, Inboxes, QR-Codes und Request Bins. Infrastruktur sind die Cloud-Ressourcen in Ihren Projekten: VMs, Speicher, Netzwerk und DNS.

Jede Operation zeigt ihren Request in der Sprache, die oben auf der Seite gewählt ist. REST ist `curl`. In TypeScript, Python und Go sehen Sie den SDK-Aufruf, wo das Produkt ein SDK hat, und sonst den üblichen HTTP-Client der jeweiligen Sprache. Sie authentifizieren sich mit einem API-Key, bei den Apps im Header `Authorization` und bei der Infrastruktur im Header `X-API-Key`, eingerichtet wie unter [REST-API](/docs/setup/rest) beschrieben. Bei den Apps haben Fehler ein gemeinsames Format, beschrieben unter [Fehler](/docs/errors); für die Infrastruktur siehe [Konventionen](/docs/conventions#errors).
