---
title: "Request-Bins-API"
description: "Jede Operation der REST-API von Request Bins, mit dem Request in curl, TypeScript, Python oder Go."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# Request-Bins-API

Die REST-API hinter [Request Bins](/docs/product-bins): Bins anlegen und über ihre URL finden; sie umbenennen, deaktivieren und löschen; das, was sie aufzeichnen, an Ihren eigenen Server weiterleiten und die Weiterleitung testen; die aufgezeichneten Requests lesen und durchsuchen, in einem Bin oder über alle hinweg, die Requests eines Bins nach Pfad gruppieren und die Bins leeren; sowie Tarif und Verbrauch prüfen, samt dem, was mit Guthaben gekauft wurde. Jede Operation unten zeigt ihren Request in der Sprache, die oben auf der Seite gewählt ist. Request Bins hat noch kein SDK, daher verwenden TypeScript, Python und Go den üblichen HTTP-Client der jeweiligen Sprache.

Aufrufe brauchen einen API-Key für Request Bins, den Sie in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) erstellen. Erfasste Requests mit einem Key zu lesen erfordert einen bezahlten Tarif; der [Schnellstart](/docs/product-bins/quickstart) führt durch einen ersten Bin, und die [Referenz](/docs/product-bins/reference) behandelt, was eine Bin-URL antwortet, die Rollen und die Limits jedes Tarifs.
