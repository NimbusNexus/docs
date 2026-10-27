---
title: "Webhooks-API"
description: "Jede Operation der REST-API von Webhooks, mit dem REST-Aufruf, dem SDK-Aufruf in Python, TypeScript oder Go und dem passenden Befehl von nn-webhooks."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# Webhooks-API

Die REST-API hinter [Webhooks](/docs/product-webhooks): Events veröffentlichen, die Endpoints verwalten, die sie empfangen, und Zustellungen einsehen, erneut zustellen und erneut abspielen. Jede Operation unten zeigt ihren Request in der Sprache, die oben auf der Seite gewählt ist. Wo das [SDK](/docs/product-webhooks/sdks) oder die [CLI](/docs/product-webhooks/cli) die Operation anbietet, sehen Sie diesen Aufruf; andernfalls sehen Sie einen einfachen HTTP-Request.

Aufrufe brauchen einen API-Key für Webhooks, den Sie in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys) erstellen. Sein Scope bestimmt, was er darf: `admin` darf alles, `publish` darf nur veröffentlichen und `read` darf nur lesen. Schreibende Aufrufe, die ein Projekt entgegennehmen, gelten für das Standardprojekt des Workspaces, sofern Sie nicht `project_id` übergeben.
