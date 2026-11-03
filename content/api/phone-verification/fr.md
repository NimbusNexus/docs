---
title: "Vérification du téléphone"
description: "Ajoutez un numéro de téléphone à votre utilisateur et vérifiez-le avec un code envoyé par SMS."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: phone-verification
---

# Vérification du téléphone

La vérification du téléphone ajoute un numéro de téléphone à votre utilisateur et s’assure qu’il permet bien de vous joindre. La vérification suit le processus classique « nous envoyons un code par SMS, vous le saisissez ».

`POST /api/v1/phone/` prend un `phone_code` (l’indicatif téléphonique du pays, en chiffres uniquement) et un `phone_number`, et envoie par SMS un code à six chiffres à ce numéro. Le code est valable 10 minutes. `POST /api/v1/phone/phone_passcode_validation` avec ce `passcode` marque le numéro comme vérifié. `GET /api/v1/phone/` affiche le numéro vérifié, et `DELETE /api/v1/phone/` le supprime. Pour changer de numéro, recommencez avec `POST /api/v1/phone/`.

Un numéro vérifié n’est ni un second facteur ni un canal de récupération. [L’authentification à deux facteurs](/docs/api/two-factor-auth) utilise un code TOTP, et un mot de passe perdu se réinitialise par e-mail (voir [Vue d’ensemble du compte](/docs/api/account-overview)).

## Étapes suivantes {#next-steps}

- [Authentification à deux facteurs](/docs/api/two-factor-auth) — le second facteur TOTP.
- [Utilisateurs](/docs/api/users) — la ressource à laquelle sont rattachés les numéros de téléphone.
