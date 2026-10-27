---
title: "Telefonverifizierung"
description: "Eine Telefonnummer für 2FA per SMS und die Kontowiederherstellung verifizieren."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: phone-verification
---

# Telefonverifizierung

Eine verifizierte Telefonnummer kann als Ausweichlösung für den zweiten Faktor und als Wiederherstellungskanal dienen, für den seltenen Fall, dass ein Benutzer sowohl sein Passwort als auch sein TOTP-/WebAuthn-Gerät verloren hat. Die Verifizierung ist der übliche Ablauf „wir senden einen Code per SMS, Sie geben ihn ein“.

SMS als primärer 2FA-Faktor ist schwächer als TOTP oder WebAuthn (SIM-Swapping-Angriffe, SS7-Schwachstellen). NimbusNexus unterstützt 2FA per SMS, verwendet bei neuer Einrichtung aber standardmäßig TOTP; für Konten im Tarif Production wird SMS nur als Weg zur Wiederherstellung angeboten. Konten im Tarif Enterprise können SMS ganz deaktivieren, wenn ihr Bedrohungsmodell es ausschließt.

## Nächste Schritte {#next-steps}

- [Zwei-Faktor-Authentifizierung](/docs/api/two-factor-auth) — die primäre Einrichtung der 2FA.
- [Benutzer](/docs/api/users) — die Ressource, der Telefonnummern zugeordnet sind.
