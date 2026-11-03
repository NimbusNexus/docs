---
title: "Stockage objet"
description: "Conteneurs et objets de votre projet, avec des options de lecture publique et des identifiants de courte durée."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Stockage objet

Le stockage objet NimbusNexus conserve les fichiers sous forme d’objets dans des conteneurs qui appartiennent à votre projet. Vous gérez les uns et les autres via `/api/v1/object_storage/`, avec les mêmes identifiants que pour le reste de l’API.

## Conteneurs {#containers}

`POST /api/v1/object_storage/` crée un conteneur. Définissez `public_read: true` pour permettre à quiconque de lire individuellement les objets dont il connaît l’URL, et ajoutez `public_listing: true` pour permettre aussi à quiconque de lister le contenu du conteneur ; avec `public_listing` sans `public_read`, l’API répond `400`. Pour un nom qui existe déjà, elle répond `409`.

`GET /api/v1/object_storage/` liste vos conteneurs avec leurs `bytes` et `count`. `PATCH /api/v1/object_storage/{container_name}` met à jour les métadonnées d’un conteneur, et `DELETE /api/v1/object_storage/{container_name}` supprime un conteneur vide ; pour un conteneur qui contient encore des objets, l’API répond `409`.

## Nommage des conteneurs {#naming}

Un nom de conteneur compte 3–63 caractères parmi les lettres minuscules, les chiffres et les tirets, et commence et se termine par une lettre ou un chiffre. Les tirets bas, les points et les espaces ne sont pas autorisés, pas plus qu’un nom au format d’une adresse IP.

## Objets {#objects}

- `POST /api/v1/object_storage/{container_name}/objects` téléverse un nouvel objet en multipart dans `file`, sous le nom `object_name` ou, à défaut, sous le nom du fichier. Pour un nom qui existe déjà, l’API répond `409`.
- `PUT /api/v1/object_storage/{container_name}/objects/{object_name}/content` remplace le contenu d’un objet.
- `GET /api/v1/object_storage/{container_name}/objects/{object_name}/content` le télécharge : le texte en UTF-8, le contenu binaire encodé en base64.
- `GET` et `PATCH /api/v1/object_storage/{container_name}/objects/{object_name}` lisent et mettent à jour ses métadonnées, et `DELETE` sur le même chemin le supprime.
- `POST /api/v1/object_storage/{container_name}/objects/{object_name}/copy` et `/move` le copient ou le déplacent sous un nouveau nom ou dans un autre conteneur.

Un nom d’objet peut contenir `/`, qui se lit comme un chemin de dossier.

## Listage et pagination {#listing}

`GET /api/v1/object_storage/{container_name}/objects` liste les objets d’un conteneur. Paginez avec `limit` et `marker` (le dernier nom que vous avez vu), ou définissez `full_listing=true` pour tous les obtenir en une seule réponse. `prefix` ne garde que les noms qui commencent par cette valeur.

Passez `delimiter=/` pour un listage de type dossier : les objets de ce niveau sont renvoyés dans `objects`, et les préfixes du niveau inférieur dans `subdirs`.

## Identifiants de courte durée {#credentials}

`POST /api/v1/object_storage/credentials` émet un identifiant de courte durée, propre au projet, pour le projet sur lequel porte votre session, et renvoie son `trust_id` et son `expires_at`. Vous pouvez demander une durée de vie avec `ttl_seconds` ; le serveur la plafonne. Un éditeur autonome envoie le `trust_id` dans un header `X-Trust-Id` lors des appels suivants au stockage objet : il accède ainsi au stockage du projet sans détenir votre token complet ni aucun secret durable ; chaque appel s’authentifie tout de même comme d’habitude. `DELETE /api/v1/object_storage/credentials/{trust_id}` le révoque.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — les clés API se placent dans le header `X-API-Key`.
- [Stockage en bloc](/docs/api/block-storage) — quand vous voulez un système de fichiers plutôt qu’un stockage clé-valeur, ou que vous avez besoin de la sémantique POSIX.
- [Éditeur Mosaic]({{BASE_URL}}/products/mosaic) — éditeur dans le navigateur pour les fichiers YAML/JSON/Markdown de vos conteneurs.
