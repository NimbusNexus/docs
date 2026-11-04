---
title: "Projektübergreifende Trusts"
description: "Kurzlebige Delegierungen, mit denen NimbusNexus in einem Projekt für Sie handelt, für Jobs in der Warteschlange und Credentials für den Objektspeicher."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: cross-project-trusts
---

# Projektübergreifende Trusts

Ein Trust ist eine kurzlebige Delegierung von Ihnen an den eigenen Dienstbenutzer von NimbusNexus, in einem Ihrer Projekte. NimbusNexus erstellt einen, wenn es Arbeit für Sie noch abschließen muss, nachdem Ihr Aufruf bereits zurückgekehrt ist, etwa ein Erstellen oder Löschen einer VM aus der Warteschlange oder das Erstellen eines Volumes, und wenn Sie ein Credential für den Objektspeicher ausstellen. Ein Trust-Datensatz zeigt die `trustor_user_id` (Sie), die `trustee_user_id` (NimbusNexus), die `project_id`, die `roles` (`member` bei jedem Trust, den NimbusNexus erstellt), ein `expires_at` und ein Flag `impersonation`.

Der Trust, den Sie bewusst erstellen, ist ein Credential für den Objektspeicher. `POST /api/v1/object_storage/credentials` stellt eines für Ihr aktuelles Projekt aus und gibt seine `trust_id` zurück. Ein eigenständiger Editor legt diese ID bei Aufrufen an den Objektspeicher im Header `X-Trust-Id` vor und erreicht so den Speicher des Projekts, ohne Ihr vollständiges Token zu halten. `ttl_seconds` ist ein Richtwert; der Server begrenzt ihn.

`GET /api/v1/trusts/` listet Ihre Trusts auf, und `GET /api/v1/trusts/{trust_id}` liest einen. `DELETE /api/v1/trusts/{trust_id}` widerruft einen, zum Beispiel ein Speicher-Credential, das Sie nicht mehr brauchen.

## Nächste Schritte {#next-steps}

- [Rollen](/docs/api/roles) — was ein Trust delegiert.
- [Benutzer](/docs/api/users) und [Projekte](/docs/api/projects) — die beiden Seiten eines Trusts.
- [Objektspeicher](/docs/api/object-storage) — wo ein Speicher-Credential verwendet wird.
- [Sicherheitsmodell](/docs/security) — der größere Zusammenhang für das IAM-Design.
