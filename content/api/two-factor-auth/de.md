---
title: "Zwei-Faktor-Authentifizierung"
description: "Ein TOTP-Zweitfaktor aus einer Authenticator-App, zusätzlich zu Ihrem Passwort."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: two-factor-auth
---

# Zwei-Faktor-Authentifizierung

Die Zwei-Faktor-Authentifizierung ergänzt die Anmeldung per Passwort um einen zweiten Faktor (einen TOTP-Code aus einer Authenticator-App). Die Endpoints hier schalten sie ein, melden ihren Status und schalten sie wieder aus:

- `GET /api/v1/2fa/credential` — erzeugt ein TOTP-Secret und gibt seinen QR-Code als Bild zurück. Das Secret selbst kommt im Response-Header `X-Secret-Key`.
- `POST /api/v1/2fa/totp_passcode_validation` — senden Sie dieses Secret als `secretKey`, zusammen mit einem aktuellen sechsstelligen `passcode` aus der App. Stimmt der Code, ist 2FA aktiv.
- `GET /api/v1/2fa/status` — `two_factor_enabled` gibt an, ob 2FA aktiv ist.
- `POST /api/v1/2fa/off` — schaltet 2FA aus.

Jeder Benutzer hat ein TOTP-Secret; eine erneute Einrichtung ersetzt es.

Für Nutzer des Dashboards läuft 2FA im Browser über die Seite mit den Kontoeinstellungen. Über die API liest oder ändert jeder Aufruf nur die eigene 2FA des angemeldeten Aufrufers, nie die eines anderen Benutzers. Aufrufer mit API-Key brauchen keine 2FA — Keys sind selbst ein Faktor der Art „etwas, das Sie besitzen“.

Dringende Empfehlung: Aktivieren Sie 2FA für jedes Konto, hinter dem ein Mensch steht und das Rollen in Produktionsprojekten hat. Die meisten kompromittierten Konten gehen auf wiederverwendete Passwörter + fehlenden zweiten Faktor zurück.

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — die Ressource, zu der 2FA gehört.
- [Authentifizierung](/docs/authentication) — wie API-Keys funktionieren (der Weg ohne 2FA).
- [Sicherheitsmodell](/docs/security) — der größere Zusammenhang.
