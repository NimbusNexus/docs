---
title: "Telefonverifizierung"
description: "Eine Telefonnummer zu Ihrem Benutzer hinzufügen und mit einem per SMS gesendeten Code bestätigen."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: phone-verification
---

# Telefonverifizierung

Die Telefonverifizierung fügt Ihrem Benutzer eine Telefonnummer hinzu und prüft, ob sie Sie erreicht. Die Verifizierung ist der übliche Ablauf „wir senden einen Code per SMS, Sie geben ihn ein“.

`POST /api/v1/phone/` nimmt einen `phone_code` (die internationale Vorwahl, nur Ziffern) und eine `phone_number` entgegen und sendet einen sechsstelligen Code per SMS an diese Nummer. Der Code ist 10 Minuten lang gültig. `POST /api/v1/phone/phone_passcode_validation` mit diesem `passcode` markiert die Nummer als verifiziert. `GET /api/v1/phone/` zeigt die verifizierte Nummer, und `DELETE /api/v1/phone/` entfernt sie. Um die Nummer zu ändern, beginnen Sie erneut mit `POST /api/v1/phone/`.

Eine verifizierte Nummer ist weder ein zweiter Faktor noch ein Wiederherstellungskanal. Die [Zwei-Faktor-Authentifizierung](/docs/api/two-factor-auth) verwendet einen TOTP-Code, und ein verlorenes Passwort wird per E-Mail zurückgesetzt (siehe [Kontoübersicht](/docs/api/account-overview)).

## Nächste Schritte {#next-steps}

- [Zwei-Faktor-Authentifizierung](/docs/api/two-factor-auth) — der TOTP-Zweitfaktor.
- [Benutzer](/docs/api/users) — die Ressource, der Telefonnummern zugeordnet sind.
