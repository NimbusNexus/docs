---
title: "Zwei-Faktor-Authentifizierung"
description: "TOTP und WebAuthn als zweiter Faktor für Ihr Konto."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: two-factor-auth
---

# Zwei-Faktor-Authentifizierung

Die Zwei-Faktor-Authentifizierung ergänzt die Anmeldung per Passwort um einen zweiten Faktor (einen TOTP-Code aus einer Authenticator-App oder einen WebAuthn-Passkey). Die Endpoints hier decken die Einrichtung, das Auflisten von Geräten, das Entfernen von Geräten und das Herunterladen von Wiederherstellungscodes ab.

Für Nutzer des Dashboards läuft 2FA im Browser über die Seite mit den Kontoeinstellungen; die API hier ist für Automatisierung gedacht (einen neuen Admin-Benutzer bereitstellen, Wiederherstellungscodes programmatisch rotieren, 2FA vor einem Compliance-Audit für die ganze Organisation erzwingen). Aufrufer mit API-Key brauchen keine 2FA — Keys sind selbst ein Faktor der Art „etwas, das Sie besitzen“; 2FA schützt den Weg, auf dem sich Menschen am Dashboard anmelden.

Dringende Empfehlung: Aktivieren Sie 2FA für jedes Konto, hinter dem ein Mensch steht und das Rollen in Produktionsprojekten hat. Die meisten kompromittierten Konten gehen auf wiederverwendete Passwörter + fehlenden zweiten Faktor zurück.

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — die Ressource, zu der 2FA gehört.
- [Authentifizierung](/docs/authentication) — wie API-Keys funktionieren (der Weg ohne 2FA).
- [Sicherheitsmodell](/docs/security) — der größere Zusammenhang.
