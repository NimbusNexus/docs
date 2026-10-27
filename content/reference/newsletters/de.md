---
title: "Newsletters-API"
description: "Jede Operation der REST-API von Newsletters, mit dem Request in curl, TypeScript, Python oder Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# Newsletters-API

Die REST-API hinter Newsletters: Listen und ihre Themen verwalten, Anmeldeformulare mit Double-Opt-in veröffentlichen, Abonnenten und ihre Einwilligungen verwalten sowie Ausgaben schreiben, testen und versenden. Jede Operation unten zeigt ihren Request in der Sprache, die oben auf der Seite gewählt ist. Newsletters hat noch kein SDK, daher verwenden TypeScript, Python und Go den üblichen HTTP-Client der jeweiligen Sprache.

Aufrufe brauchen einen API-Key für Newsletters, den Sie in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys) erstellen. Die öffentlichen Routen für Abonnenten brauchen keinen Key: Genau diese Routen rufen ein Anmeldeformular und die Links in versendeter Mail auf.
