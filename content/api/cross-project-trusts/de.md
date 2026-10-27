---
title: "Projektübergreifende Trusts"
description: "Zeitlich begrenzte Vergabe von Berechtigungen zwischen Projekten. Der richtige Baustein für projektübergreifende Automatisierung."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: cross-project-trusts
---

# Projektübergreifende Trusts

Ein Trust erteilt einem Benutzer in einem Projekt die vorübergehende Berechtigung, in einem anderen Projekt zu handeln — ohne dass dieser Benutzer dort Mitglied sein oder einen gemeinsamen API-Key haben muss. Der Trust enthält eine bestimmte Rolle, ein Ablaufdatum und einen optionalen Impersonation-Scope.

Der typische Anwendungsfall: eine CI/CD-Pipeline, die dem Projekt `shared-infra` zugeordnet ist, aber Ressourcen in `acme-prod` deployen muss. Ohne Trusts müssten Sie dem CI-Key entweder Admin-Rechte in beiden Projekten geben (schlechter Schadensradius) oder Keys zwischen Projekten kopieren (noch schlechter). Mit einem Trust stellt `shared-infra` eine zeitlich begrenzte Berechtigung `vms:write` in `acme-prod` aus; die CI-Aufrufe legen den Trust zusammen mit ihren normalen Credentials vor.

Trusts halten sich an das Sicherheitsmodell — der erteilende Benutzer kann nur Rollen vergeben, die er selbst hat, und der Trust läuft spätestens dann ab, wenn die Berechtigung abläuft, die er weitergibt. Es gibt keinen Weg zur Rechteausweitung.

## Nächste Schritte {#next-steps}

- [Rollen](/docs/api/roles) — was ein Trust delegiert.
- [Benutzer](/docs/api/users) und [Projekte](/docs/api/projects) — die beiden Seiten eines Trusts.
- [Sicherheitsmodell](/docs/security) — der größere Zusammenhang für das IAM-Design.
