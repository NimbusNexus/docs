---
title: "Clés SSH"
description: "Clés publiques enregistrées sur le projet et injectées dans les VM au démarrage."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Clés SSH

Les clés SSH vous permettent de vous connecter aux VM Linux une fois qu’elles ont démarré. Enregistrez votre clé publique sur le projet ; cloud-init la dépose dans le fichier `~/.ssh/authorized_keys` de l’utilisateur par défaut de chaque nouvelle VM.

## Comment ça marche {#how-it-works}

Vous n’enregistrez que la clé **publique** — NimbusNexus ne voit jamais votre clé privée. Au démarrage, le service de métadonnées expose les clés publiques enregistrées du projet à cloud-init, qui les écrit dans le fichier authorized_keys de l’utilisateur par défaut (`ubuntu` sur Ubuntu, `debian` sur Debian, `rocky` sur Rocky, `Administrator` pour Windows via WinRM).

Les clés ajoutées **après** le démarrage d’une VM ne sont pas poussées automatiquement vers les VM en cours d’exécution. Redémarrez la VM (par défaut, cloud-init ne s’exécute qu’au premier démarrage : cela n’aide donc qu’avec les images qui activent la réexécution), ou ajoutez la clé dans la VM avec votre outil habituel de gestion de configuration.

## Formats pris en charge {#formats}

Nous acceptons :

- **ed25519** — recommandé ; petit, rapide, moderne
- **ecdsa-sha2-nistp256 / nistp384 / nistp521**
- **RSA** — 2048 bits minimum ; 4096 bits recommandés ; nous rejetons < 2048

DSA est rejeté (il est déprécié en amont depuis OpenSSH 7.0).

La chaîne de la clé doit être au format OpenSSH — la ligne unique qui commence par `ssh-ed25519`, `ecdsa-sha2-nistp...` ou `ssh-rsa`, suivie du matériel de clé encodé en base64, et éventuellement d’un commentaire. C’est ce que contiennent par défaut les fichiers `~/.ssh/id_*.pub`.

## Empreintes et doublons {#fingerprints}

Chaque clé a une **empreinte SHA256** stable. L’API rejette les doublons par empreinte — ajouter deux fois la même clé (même avec un libellé différent) renvoie 409. Cela intercepte l’erreur courante « j’ai ajouté la clé de mon portable à deux projets » avant qu’elle ne brouille l’attribution aux comptes.

## Supprimer une clé {#removing}

Supprimer une clé du projet la retire des futurs démarrages de VM. **Les VM déjà démarrées conservent la clé** dans leur fichier authorized_keys — cloud-init n’est pas un outil de réconciliation d’état, c’est un installateur de premier démarrage. Pour révoquer une clé sur des VM en cours d’exécution, au choix :

1. Recréez les VM à partir d’un snapshot récent, ou
2. Modifiez `~/.ssh/authorized_keys` directement dans la VM (ou via votre outil de gestion de configuration).

Si l’objectif est une révocation rapide parce que la clé a été compromise : la console propose une action en un clic, « revoke from all projects », qui pousse une suppression via le service de métadonnées. L’équivalent API se trouve dans la référence IAM (à venir).

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — les VM utilisent ces clés au démarrage.
- [Authentification](/docs/authentication) — les clés API n’ont aucun rapport ; elles servent à l’API de gestion, pas à la connexion aux VM.
