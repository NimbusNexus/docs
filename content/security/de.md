---
title: "Sicherheitsmodell"
description: "Wie Keys, Scopes, Projekte und Audit-Logs zusammen den Schadensradius begrenzen."
publishedAt: 2026-05-20
updatedAt: 2026-10-16
kind: concept
---

# Sicherheitsmodell

Das Sicherheitskonzept von NimbusNexus ruht auf vier Säulen: API-Keys sind der einzige Weg, sich zu authentifizieren, Projekte sind die Einheit der Isolation, Scopes schränken ein, was jeder Key tun darf, und Audit-Logs zeichnen alles auf, was von Bedeutung war. Diese Seite ist der konzeptionelle Überblick; für die Details hat jeder Baustein eine eigene Referenzseite.

## Die Vertrauensgrenze {#trust-boundary}

Ein einzelnes Projekt ist die Vertrauensgrenze. Innerhalb eines Projekts kann jeder autorisierte Aufrufer auf jede Ressource einwirken. Über Projektgrenzen hinweg kann nichts etwas anderes beeinflussen — Projekte teilen sich keine Netzwerke, keine IAM-Berechtigungen und keine Kontingente.

So ist es gewollt. Wenn zwei Workloads voneinander isoliert sein müssen (Produktion von Staging, Kunde A von Kunde B), legen Sie sie in verschiedene Projekte. Versuchen Sie nicht, Isolation über Scopes oder Bezeichnungen innerhalb eines Projekts herzustellen — Scopes beschränken, was ein einzelner Key tun darf, aber ein kompromittierter Admin-Key im Projekt hat weiterhin vollen Zugriff.

## API-Keys {#api-keys}

Das einzige Credential, das die API akzeptiert, ist ein API-Key. Es gibt keinen OAuth-Flow pro Benutzer, keinen JWT-Signatur-Flow, kein mTLS — nur Bearer-Keys. Warum ein einziger Mechanismus: Jeder zusätzliche Credential-Typ vergrößert die Angriffsfläche (Ausstellung, Widerruf, Verteilung), und wir machen lieber den einen, den wir haben, wasserdicht.

Keys sind:

- **An ein Projekt gebunden.** Ein Key für das Projekt `acme-prod` kann nichts in `acme-staging` lesen, auch nicht im selben Konto.
- **Langlebig, aber rotierbar.** Ein heute erstellter Key gilt, bis Sie ihn rotieren oder widerrufen. Die Rotation hat eine Übergangsfrist von 24 Stunden, damit Sie den neuen Key ohne Ausfall ausrollen können.
- **Nur über das Dashboard erstellt.** Es gibt keine API zum Erstellen von Keys. Ein kompromittierter Key kann keinen weiteren Key erzeugen — die Wiederherstellung muss über einen Out-of-Band-Kanal laufen.

Den Aufbau von Requests, die Liste der Scopes, den Ablauf der Rotation und die Fehlercodes beschreibt [Authentifizierung](/docs/authentication).

## Scopes {#scopes}

Jeder Key trägt eine Menge von Scopes, die begrenzen, was er in seinem Projekt tun darf. Die vollständige Liste folgt den Ressourcentypen:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:*`, `block-storage:*`, `object-storage:*`, `iam:*`, ...

Scopes sind ein additives System: Ein Key hat die Vereinigung aller Scopes, die ihm erteilt wurden. Es gibt keine Negation, keine Vorrangregeln und keine Rollen, die Sie durchdenken müssen.

Das richtige Muster: **eng beginnen, bei Fehlschlägen erweitern**. Erstellen Sie den Key nur mit den Scopes, von denen Sie wissen, dass Sie sie brauchen; lassen Sie die Anwendung mit `403 forbidden` (`details.reason` ist `scope`) fehlschlagen, wenn einer fehlt, und fügen Sie ihn dann hinzu. So fallen Fehler wie „Ich habe meinem CI-Job versehentlich Admin-Rechte gegeben“ in der Entwicklung auf, nicht in der Produktion.

## Projekte {#projects}

Projekte sind der stärkste Baustein für Isolation — sie sind die Grenze für Ressourcen, für die Abrechnung und für die Zugriffskontrolle. Ein Benutzer mit Admin-Rechten im Projekt `acme-prod` sieht keine Ressourcen im Projekt `acme-staging`, es sei denn, er hat dort ebenfalls Admin-Rechte (oder irgendeinen Scope).

Die meisten Teams wollen **mindestens ein Projekt pro Umgebung** (`prod`, `staging`, `dev`). Der Grund: Ein kompromittierter Dev-Key soll keine Produktionsdaten erreichen können. Noch besser: ein Projekt pro Kombination aus Umgebung + Dienst (`acme-prod-api`, `acme-prod-batch`), damit ein Credential-Leck im Batch-Job keine Kundendaten der API lesen kann.

Den Aufbau der Ressource und die Mechanik der Hierarchie beschreibt [Projekte](/docs/api/projects).

## Netzwerkmodell {#network}

Standardmäßig ist eine VM isoliert. Damit sie ausgehend das Internet erreicht, hängen Sie eine [Floating-IP](/docs/api/floating-ips) an oder binden sie an ein Netzwerk mit Router an. Um eingehenden Traffic anzunehmen, hängen Sie die Floating-IP an und setzen (typischerweise) eine [Sicherheitsgruppe](/docs/api/security-groups) als zustandsbehaftete Firewall davor.

Projektübergreifende Netzwerke gibt es nicht. Eine VM im Projekt `acme-prod` kann keinen Traffic an eine VM im Projekt `acme-staging` senden, Punkt, auch nicht über private IPs — der zugrunde liegende virtuelle Switch erzwingt die Isolation auf Projektebene. Wenn Sie projektübergreifende Kommunikation brauchen (selten), lautet das richtige Muster „eine öffentliche API bereitstellen und sie über das Internet aufrufen“ — dieselbe Vertrauensgrenze, als lägen die beiden Workloads bei verschiedenen Unternehmen.

VPC-Peering und ähnliche projektübergreifende Netzwerkbausteine kommen vielleicht später; heute gibt es sie nicht, und das ist eine bewusste Einschränkung.

## Audit-Logs {#audit}

Jeder authentifizierte Request, der einen Zustand ändert, wird protokolliert mit:

- `request_id` — dieselbe ID, die in Fehlerantworten erscheint
- `key_id` — welcher Key den Aufruf gesendet hat (Präfix + letzte 4 Zeichen, nie das vollständige Secret)
- `user_id` — der Benutzer, der den Key erstellt hat
- `operation` — `vms.create`, `database.delete` usw.
- `resource_id` — die betroffene Ressource
- `project_id` — welches Projekt
- `result` — `success`, `validation_error`, `unauthorized` usw.
- `client_ip` — die Quell-IP
- `timestamp` — ISO 8601 UTC

Audit-Logs stehen im Dashboard mit Filter + Export bereit und über die IAM-Audit-API. Die Aufbewahrung beträgt **365 Tage** in den Tarifen Free und Starter, **2 Jahre** in Production und ist in Enterprise konfigurierbar.

Requests mit `GET` werden für Ressourcen protokolliert, die als sensibel markiert sind (IAM, Abrechnung, Zahlungsmethoden); routinemäßige Lesezugriffe (VMs auflisten) werden nicht protokolliert, damit das Logvolumen beherrschbar bleibt. Die Liste der „sensiblen Lesezugriffe“ ist auf der IAM-Referenzseite dokumentiert.

## Ruhende Daten {#at-rest}

- **Block-Volumes:** AES-256-XTS mit Schlüsseln pro Volume, die wir verwalten. Vom Kunden verwaltete Schlüssel (CMK) sind auf der Roadmap; noch nicht verfügbar.
- **Objektspeicher:** standardmäßig serverseitiges AES-256; SSE-C (vom Kunden bereitgestellte Schlüssel) und SSE-KMS (CMK über KMS) sind verfügbar.
- **Backups + Snapshots:** dieselbe Verschlüsselung wie das Quell-Volume/-Objekt.
- **Datenbank-Backups:** dieselbe Verschlüsselung + die eigene Verschlüsselung ruhender Daten der Datenbank-Engine, falls aktiviert.

## Daten bei der Übertragung {#in-transit}

Der gesamte API-Traffic läuft über TLS 1.3 (TLS 1.2 wird akzeptiert; ältere Versionen lehnt das Gateway ab). Verbindungen zum Objektspeicher und zu Datenbanken verwenden TLS 1.3, und unsere Zertifikate werden automatisch rotiert. Zustellungen von Webhooks von uns an Sie verwenden TLS; URLs mit `http://` akzeptieren wir für Webhook-Endpoints nicht.

## Sicherheitslücke melden {#disclosure}

Sie haben ein Sicherheitsproblem gefunden? Eröffnen Sie kein GitHub-Issue (das ist öffentlich) und senden Sie kein normales Support-Ticket (langsamere Triage). Das [Formular für Sicherheitsmeldungen]({{BASE_URL}}/contact/security) geht direkt an das Sicherheitsteam, akzeptiert PGP-verschlüsselte Nachrichtentexte, und wir bestätigen den Eingang innerhalb von 24 Stunden.

Die Safe-Harbor-Bedingungen finden Sie unter [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Forschung in gutem Glauben ist willkommen.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — wie Keys, Scopes und Rotation in der Praxis funktionieren.
- [Projekte](/docs/api/projects) — die Einheit der Isolation.
- [Plattform-Webhooks](/docs/webhooks) — die eingehenden Zustellungen absichern, die wir an Ihre Endpoints senden.
