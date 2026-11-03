---
title: "Clés SSH"
description: "Clés publiques enregistrées sous votre utilisateur et installées dans une VM au démarrage."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Clés SSH

Les clés SSH vous permettent de vous connecter aux VM Linux une fois qu’elles ont démarré. Enregistrez une clé sous votre utilisateur, puis indiquez-la dans `sshs` quand vous créez une VM ; cloud-init l’écrit dans le fichier `~/.ssh/authorized_keys` de l’utilisateur par défaut.

## Comment ça marche {#how-it-works}

Il y a deux façons d’enregistrer une clé :

- `POST /api/v1/ssh/add_public` avec un `name` et votre `ssh_public_key`. Vous n’envoyez que la clé **publique** ; la clé privée reste chez vous.
- `POST /api/v1/ssh/` avec un `name` génère une paire de clés et renvoie sa `private_key` une seule fois. Enregistrez-la à ce moment-là : l’API ne l’affiche plus jamais.

Une VM reçoit l’unique clé que vous indiquez dans `sshs` lors de sa création. Au démarrage, le service de métadonnées expose cette clé publique à cloud-init, qui l’écrit dans le fichier authorized_keys de l’utilisateur par défaut.

Les clés ajoutées **après** le démarrage d’une VM ne sont pas poussées automatiquement vers les VM en cours d’exécution. Une VM conserve la clé avec laquelle elle a été créée : ajoutez donc une nouvelle clé dans la VM avec votre outil habituel de gestion de configuration.

## Formats pris en charge {#formats}

La chaîne de la clé doit être au format OpenSSH — la ligne unique qui commence par `ssh-ed25519`, `ecdsa-sha2-nistp...` ou `ssh-rsa`, suivie du matériel de clé encodé en base64, et éventuellement d’un commentaire. C’est ce que contiennent par défaut les fichiers `~/.ssh/id_*.pub`.

## Empreintes et doublons {#fingerprints}

Chaque clé a une **empreinte SHA256** stable. `GET /api/v1/ssh/` liste vos clés avec leur `fingerprint` et leur `key` publique. Les noms de clé doivent être uniques parmi vos clés : si vous enregistrez une deuxième clé sous un nom que vous utilisez déjà, l’API répond `409`.

## Supprimer une clé {#removing}

`DELETE /api/v1/ssh/` avec l’ID de la clé dans `ssh_keys` la supprime : les nouvelles VM ne peuvent donc plus l’utiliser. **Les VM déjà démarrées conservent la clé** dans leur fichier authorized_keys — cloud-init n’est pas un outil de réconciliation d’état, c’est un installateur de premier démarrage. Pour révoquer une clé sur des VM en cours d’exécution, au choix :

1. Recréez les VM avec une autre clé dans `sshs`, ou
2. Modifiez `~/.ssh/authorized_keys` directement dans la VM (ou via votre outil de gestion de configuration).

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — les VM utilisent ces clés au démarrage.
- [Authentification](/docs/authentication) — les clés API servent à l’API de gestion, pas à la connexion aux VM. Les endpoints des clés SSH exigent une session connectée, pas une clé API.
