---
title: "Vérification du téléphone"
description: "Vérifiez un numéro de téléphone pour la 2FA par SMS et la récupération du compte."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: phone-verification
---

# Vérification du téléphone

Un numéro de téléphone vérifié peut servir de second facteur de secours et de canal de récupération dans le cas rare où un utilisateur a perdu à la fois son mot de passe et son appareil TOTP/WebAuthn. La vérification suit le processus classique « nous envoyons un code par SMS, vous le saisissez ».

Le SMS comme facteur 2FA principal est plus faible que TOTP ou WebAuthn (attaques par SIM swap, failles de SS7). NimbusNexus prend en charge la 2FA par SMS mais utilise TOTP par défaut pour tout nouvel enrôlement ; pour les comptes de niveau Production, le SMS n’est proposé que comme voie de récupération. Les comptes Enterprise peuvent désactiver complètement le SMS si leur modèle de menace l’exclut.

## Étapes suivantes {#next-steps}

- [Authentification à deux facteurs](/docs/api/two-factor-auth) — la configuration principale de la 2FA.
- [Utilisateurs](/docs/api/users) — la ressource à laquelle sont rattachés les numéros de téléphone.
