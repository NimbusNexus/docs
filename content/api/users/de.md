---
title: "Benutzer"
description: "Identitätsdatensätze innerhalb eines Projekts — Rollen zuweisen, API-Keys generieren, Trusts übernehmen."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Benutzer

Ein Benutzer ist eine Identität innerhalb eines [Projekts](/docs/api/projects). Benutzer haben Rollen (die Berechtigungen erteilen), können API-Keys generieren (auf den Benutzer beschränkt) und Trusts übernehmen, um im Namen anderer Projekte zu handeln.

## Benutzer ≠ Login {#identity-model}

Ein „Benutzer“ ist in dieser API **der Identitätsdatensatz**, nicht der Mensch. Dieselbe Person kann Folgendes sein:

- Ein Benutzer in `prod` (dem Produktionsprojekt)
- Ein anderer Benutzer in `staging` (eigener Identitätsdatensatz, gleiche E-Mail-Adresse)
- Ein dritter Benutzer in `dev`

Jeder Benutzer ist vollständig von den anderen isoliert — mit eigenen Rollenzuweisungen, eigenen API-Keys, eigenem Audit-Log. Auf diese Grenze der Projektisolation stützen wir uns, um den Schadensradius einzudämmen: Ein kompromittierter Benutzer in `dev` kann keine Produktionsressourcen anfassen, weil er dort als Identität buchstäblich nicht existiert.

Organisationen, die einen Menschen → eine Identität über alle Projekte hinweg wollen, föderieren über SAML/OIDC; die per SSO bereitgestellte Identität wird in allen Projekten, die die IdP-Regeln zuordnen, zum selben Benutzer. Das ist eine Enterprise-Funktion; Konten im Standardtarif verwenden das oben beschriebene Modell pro Projekt.

## Was Sie mit einem Benutzer tun können {#actions}

- **Erstellen** — einen neuen Benutzer im Projekt des Aufrufers anlegen. Erfordert `iam:write` im Projekt.
- **Abrufen** — einen Benutzerdatensatz lesen. `iam:read` genügt.
- **Aktualisieren** — Name, Beschreibung und Aktivierungs-Flag ändern. Einige Felder (z. B. die E-Mail-Adresse) sind nach dem Erstellen unveränderlich; wenn Sie es trotzdem versuchen, antwortet die API mit 400.
- **Löschen** — dauerhaft entfernen. Alle Rollenzuweisungen und API-Keys des Benutzers werden atomar widerrufen.

Es gibt kein „Deaktivieren“ getrennt vom „Löschen“. Wenn Sie einen Benutzer nur weich deaktivieren wollen (Audit-Verlauf behalten, Anmeldung verhindern), setzen Sie per Aktualisierung `enabled: false` — das ist der Weg zum weichen Deaktivieren. Löschen bedeutet endgültiges Löschen + Widerruf von allem.

## Was Sie nicht tun können {#cant-do}

- **Einen Benutzer zwischen Projekten verschieben.** Legen Sie im Zielprojekt einen neuen Benutzer an, kopieren Sie die gewünschten Rollen und löschen Sie den alten.
- **Ein Passwort über die API setzen.** Passwörter laufen ausschließlich über den Ablauf zum Zurücksetzen des Passworts; die API nimmt nie ein Passwort im Klartext entgegen. Benutzer mit SSO umgehen Passwörter vollständig.
- **Benutzer in einem Projekt auflisten, in dem Sie keine Rollenzuweisungen haben.** Die Projektisolation ist strikt — keine projektübergreifende Aufzählung.

## Nächste Schritte {#next-steps}

- [Projekte](/docs/api/projects) — der Container, in dem Benutzer liegen.
- [Rollen](/docs/api/roles) — was Sie einem Benutzer erteilen, sobald er existiert.
- [Authentifizierung](/docs/authentication) — wie API-Keys (pro Benutzer ausgestellt) funktionieren.
