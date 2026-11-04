---
title: Object storage
description: Containers and objects in your project, with public-read options and short-lived credentials.
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Object storage

NimbusNexus object storage keeps files as objects in containers that belong to your project. You manage both through `/api/v1/object_storage/`, with the same credentials as the rest of the API.

## Containers {#containers}

`POST /api/v1/object_storage/` creates a container. Set `public_read: true` to let anyone read individual objects whose URL they know, and add `public_listing: true` to let anyone list the container's contents too; `public_listing` without `public_read` answers `400`. A name that already exists answers `409`.

`GET /api/v1/object_storage/` lists your containers with their `bytes` and `count`. `PATCH /api/v1/object_storage/{container_name}` updates a container's metadata, and `DELETE /api/v1/object_storage/{container_name}` deletes an empty one; a container that still holds objects answers `409`.

## Container naming {#naming}

A container name is 3–63 characters of lowercase letters, digits and hyphens, starting and ending with a letter or digit. Underscores, periods and spaces aren't allowed, and neither is a name formatted like an IP address.

## Objects {#objects}

- `POST /api/v1/object_storage/{container_name}/objects` uploads a new object as multipart `file`, named `object_name` or, without one, after the file. A name that already exists answers `409`.
- `PUT /api/v1/object_storage/{container_name}/objects/{object_name}/content` replaces an object's content.
- `GET /api/v1/object_storage/{container_name}/objects/{object_name}/content` downloads it: text as UTF-8, binary content base64-encoded.
- `GET` and `PATCH /api/v1/object_storage/{container_name}/objects/{object_name}` read and update its metadata, and `DELETE` on the same path deletes it.
- `POST /api/v1/object_storage/{container_name}/objects/{object_name}/copy` and `/move` copy or move it to a new name or another container.

An object name can contain `/`, which reads as a folder path.

## Listing and paging {#listing}

`GET /api/v1/object_storage/{container_name}/objects` lists a container's objects. Page with `limit` and `marker` (the last name you've seen), or set `full_listing=true` to get them all in one response. `prefix` keeps only the names that start with it.

Pass `delimiter=/` for a folder-style listing: the objects at this level come back in `objects`, and the prefixes one level down in `subdirs`.

## Short-lived credentials {#credentials}

`POST /api/v1/object_storage/credentials` mints a short-lived, project-scoped credential for the project your session is scoped to, and returns its `trust_id` and `expires_at`. You can ask for a lifetime with `ttl_seconds`; the server caps it. A standalone editor sends the `trust_id` in an `X-Trust-Id` header on later object-storage calls, reaching the project's storage without holding your full token or any lasting secret; each call still authenticates as usual. `DELETE /api/v1/object_storage/credentials/{trust_id}` revokes it.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — API keys go in the `X-API-Key` header.
- [Block storage](/docs/api/block-storage) — when you want a filesystem rather than a key-value store, or you need POSIX semantics.
- [Mosaic editor]({{BASE_URL}}/products/mosaic) — browser-based editor for YAML/JSON/Markdown files inside your containers.
