---
title: "Sicherheitsmodell"
description: "Wie API-Keys, Rollen, Zugriffsregeln und Projekte zusammen den Schadensradius begrenzen."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Sicherheitsmodell

Bei der Infrastruktur-API begrenzen drei Dinge, was ein Credential tun kann: Projekte sind die Einheit der Isolation, Rollen legen fest, was ein Key in seinem Projekt tun darf, und Zugriffsregeln schränken ein, welche Aufrufe er machen darf. Diese Seite ist der konzeptionelle Überblick; für die Details hat jeder Baustein eine eigene Referenzseite.

## Die Vertrauensgrenze {#trust-boundary}

Ein einzelnes Projekt ist die Vertrauensgrenze. Innerhalb eines Projekts kann jeder autorisierte Aufrufer auf jede Ressource einwirken. Über Projektgrenzen hinweg kann nichts etwas anderes beeinflussen, es sei denn, Sie öffnen es: Eine Ressource gehört zu einem Projekt, Kontingente gelten pro Projekt, und ein Key gilt in einem Projekt.

So ist es gewollt. Wenn zwei Workloads voneinander isoliert sein müssen (Produktion von Staging, Kunde A von Kunde B), legen Sie sie in verschiedene Projekte. Versuchen Sie nicht, Isolation über Zugriffsregeln innerhalb eines Projekts herzustellen: Diese Regeln beschränken, was ein einzelner Key tun darf, aber ein anderer Key im Projekt mit weiter gefassten Regeln hat weiterhin vollen Zugriff.

## Credentials {#api-keys}

Die API nimmt zwei Arten von Credentials entgegen: einen **API-Key** im Header `X-API-Key`, für Tools und Skripte, und eine **angemeldete Sitzung**, für eine Person im Dashboard.

Keys sind:

- **An ein Projekt gebunden.** Ein Key für das Projekt `acme-prod` kann nichts in `acme-staging` lesen, auch nicht im selben Konto.
- **Persönlich.** Jeder Key gehört der Person, die ihn erstellt hat, und handelt mit Rollen, die diese Person hat.
- **Aus einer angemeldeten Sitzung erstellt**, im Dashboard oder mit `POST /api/v1/api_keys/`.
- **Gültig, bis Sie sie löschen**, oder bis zu dem `expires_at`, das Sie ihnen gegeben haben. Einen Rotations-Aufruf gibt es nicht: Um einen Key zu ersetzen, erstellen Sie den neuen, stellen Ihre Tools darauf um und löschen dann den alten.

Den Aufbau von Requests und die Details beschreibt [Authentifizierung](/docs/authentication).

## Rollen und Zugriffsregeln {#scopes}

Ein Key handelt mit `roles` in seinem Projekt, und seine `access_rules` begrenzen, welche Aufrufe er machen darf: Jede Regel nennt einen Dienst, eine Methode und einen Pfad. `unrestricted: true` bedeutet keine Zugriffsregeln, der Key darf also jeden Aufruf machen, den seine Rollen erlauben. Ein Key ohne beides kann nur seine eigene Sitzung lesen.

Das richtige Muster: **eng beginnen, bei Fehlschlägen erweitern**. Erstellen Sie den Key nur mit den Aufrufen, von denen Sie wissen, dass Sie sie brauchen. Ein Aufruf außerhalb davon erhält `403`, und Sie erstellen einen neuen Key, der ihn einschließt. So fallen Fehler wie „Ich habe meinem CI-Job versehentlich Admin-Rechte gegeben“ in der Entwicklung auf, nicht in der Produktion.

## Projekte {#projects}

Projekte sind der stärkste Baustein für Isolation: die Grenze für Ressourcen und für die Zugriffskontrolle. Abgerechnet wird pro Workspace. Eine Person mit einer Rolle im Projekt `acme-prod` sieht keine Ressourcen im Projekt `acme-staging`, es sei denn, sie hat dort ebenfalls eine Rolle.

Die meisten Teams wollen **mindestens ein Projekt pro Umgebung** (`prod`, `staging`, `dev`). Der Grund: Ein kompromittierter Dev-Key soll keine Produktionsdaten erreichen können. Noch besser: ein Projekt pro Kombination aus Umgebung + Dienst (`acme-prod-api`, `acme-prod-batch`), damit ein Credential-Leck im Batch-Job keine Kundendaten der API lesen kann.

Die Details finden Sie unter [Projekte](/docs/api/projects).

## Netzwerkmodell {#network}

Eine VM in einem privaten Netzwerk ist aus dem Internet nicht erreichbar. Damit sie ausgehend das Internet erreicht, verbinden Sie das Netzwerk mit einem [Router](/docs/api/routers) mit externem Gateway. Um eingehenden Traffic anzunehmen, hängen Sie eine [Floating-IP](/docs/api/floating-ips) an. Jede VM hat mindestens eine [Sicherheitsgruppe](/docs/api/security-groups), die jeden eingehenden Traffic ablehnt, bis Sie ihn erlauben.

Netzwerke gehören zu einem Projekt. Eine VM im Projekt `acme-prod` kann keinen Traffic über private IPs an eine VM im Projekt `acme-staging` senden, es sei denn, Sie geben mit der [Netzwerkfreigabe](/docs/api/network-sharing) ein Netzwerk zwischen ihnen frei. Peering zwischen Projektnetzwerken gibt es nicht. Ansonsten lautet das Muster „eine öffentliche API bereitstellen und sie über das Internet aufrufen“, dieselbe Vertrauensgrenze, als lägen die beiden Workloads bei verschiedenen Unternehmen.

## Daten bei der Übertragung {#in-transit}

Die API wird über HTTPS bereitgestellt. Beim Produkt [Webhooks](/docs/product-webhooks) verwenden auch die Zustellungen TLS: Die URL eines Endpoints muss `https` sein.

## Sicherheitslücke melden {#disclosure}

Sie haben ein Sicherheitsproblem gefunden? Eröffnen Sie kein GitHub-Issue (das ist öffentlich) und senden Sie kein normales Support-Ticket (langsamere Triage). Das [Formular für Sicherheitsmeldungen]({{BASE_URL}}/contact/security) geht direkt an das Sicherheitsteam, akzeptiert PGP-verschlüsselte Nachrichtentexte, und wir bestätigen den Eingang innerhalb von 24 Stunden.

Die Safe-Harbor-Bedingungen finden Sie unter [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Forschung in gutem Glauben ist willkommen.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — wie Keys, Rollen und Zugriffsregeln in der Praxis funktionieren.
- [Projekte](/docs/api/projects) — die Einheit der Isolation.
- [Netzwerkfreigabe](/docs/api/network-sharing) — der kontrollierte Weg, die Netzwerke zweier Projekte zu verbinden.
