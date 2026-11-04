---
title: "Objektspeicher"
description: "Container und Objekte in Ihrem Projekt, mit Optionen für öffentliches Lesen und kurzlebigen Credentials."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Objektspeicher

Der Objektspeicher von NimbusNexus legt Dateien als Objekte in Containern ab, die zu Ihrem Projekt gehören. Beides verwalten Sie über `/api/v1/object_storage/`, mit denselben Credentials wie die übrige API.

## Container {#containers}

`POST /api/v1/object_storage/` erstellt einen Container. Setzen Sie `public_read: true`, damit jeder einzelne Objekte lesen kann, deren URL er kennt, und fügen Sie `public_listing: true` hinzu, damit jeder auch den Inhalt des Containers auflisten kann; auf `public_listing` ohne `public_read` antwortet die API mit `400`. Auf einen Namen, den es schon gibt, antwortet sie mit `409`.

`GET /api/v1/object_storage/` listet Ihre Container mit `bytes` und `count` auf. `PATCH /api/v1/object_storage/{container_name}` aktualisiert die Metadaten eines Containers, und `DELETE /api/v1/object_storage/{container_name}` löscht einen leeren Container; auf einen Container, der noch Objekte enthält, antwortet die API mit `409`.

## Container-Namen {#naming}

Ein Container-Name besteht aus 3–63 Kleinbuchstaben, Ziffern und Bindestrichen und beginnt und endet mit einem Buchstaben oder einer Ziffer. Unterstriche, Punkte und Leerzeichen sind nicht erlaubt, ebenso wenig ein Name im Format einer IP-Adresse.

## Objekte {#objects}

- `POST /api/v1/object_storage/{container_name}/objects` lädt ein neues Objekt als Multipart-Feld `file` hoch, benannt nach `object_name` oder, wenn dieser fehlt, nach der Datei. Auf einen Namen, den es schon gibt, antwortet die API mit `409`.
- `PUT /api/v1/object_storage/{container_name}/objects/{object_name}/content` ersetzt den Inhalt eines Objekts.
- `GET /api/v1/object_storage/{container_name}/objects/{object_name}/content` lädt es herunter: Text als UTF-8, binäre Inhalte base64-kodiert.
- `GET` und `PATCH /api/v1/object_storage/{container_name}/objects/{object_name}` lesen und aktualisieren seine Metadaten, und `DELETE` auf demselben Pfad löscht es.
- `POST /api/v1/object_storage/{container_name}/objects/{object_name}/copy` und `/move` kopieren oder verschieben es unter einen neuen Namen oder in einen anderen Container.

Ein Objektname kann `/` enthalten; das wird als Ordnerpfad gelesen.

## Auflisten und Paginierung {#listing}

`GET /api/v1/object_storage/{container_name}/objects` listet die Objekte eines Containers auf. Paginieren Sie mit `limit` und `marker` (dem letzten Namen, den Sie gesehen haben), oder setzen Sie `full_listing=true`, um alle in einer Antwort zu erhalten. `prefix` behält nur die Namen, die damit beginnen.

Übergeben Sie `delimiter=/` für eine Auflistung im Ordnerstil: Die Objekte auf dieser Ebene kommen in `objects` zurück, die Präfixe eine Ebene tiefer in `subdirs`.

## Kurzlebige Credentials {#credentials}

`POST /api/v1/object_storage/credentials` stellt ein kurzlebiges, projektgebundenes Credential für das Projekt aus, für das Ihre Sitzung gilt, und gibt seine `trust_id` und sein `expires_at` zurück. Eine Lebensdauer können Sie mit `ttl_seconds` anfragen; der Server begrenzt sie. Ein eigenständiger Editor sendet die `trust_id` bei späteren Aufrufen an den Objektspeicher im Header `X-Trust-Id` und erreicht so den Speicher des Projekts, ohne Ihr vollständiges Token oder ein dauerhaftes Secret zu halten; jeder Aufruf authentifiziert sich trotzdem wie gewohnt. `DELETE /api/v1/object_storage/credentials/{trust_id}` widerruft es.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — API-Keys gehören in den Header `X-API-Key`.
- [Blockspeicher](/docs/api/block-storage) — wenn Sie ein Dateisystem statt eines Key-Value-Stores wollen oder POSIX-Semantik brauchen.
- [Mosaic-Editor]({{BASE_URL}}/products/mosaic) — browserbasierter Editor für YAML-/JSON-/Markdown-Dateien in Ihren Containern.
