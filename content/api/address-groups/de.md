---
title: "Adressgruppen"
description: "Benannte CIDR-Sätze, die Sie in Regeln von Sicherheitsgruppen wiederverwenden können."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: address-groups
---

# Adressgruppen

Eine Adressgruppe ist ein benannter, veränderbarer Satz von CIDR-Blöcken, auf den Sie in Regeln von [Sicherheitsgruppen](/docs/api/security-groups) verweisen können. Statt dieselbe Allow-List in zehn Sicherheitsgruppen einzufügen, legen Sie eine Adressgruppe an (`office-cidrs`) und verweisen in jeder Regel darauf. Fügen Sie der Gruppe einen CIDR hinzu oder entfernen Sie einen; jede Regel, die auf die Gruppe verweist, übernimmt die Änderung sofort.

Der typische Anwendungsfall: CIDRs eines Firmen-VPN, die sich mit der Zeit ändern. Wenn Sie die Liste direkt in jeder Sicherheitsgruppe pflegen, müssen Sie jede Stelle suchen, sobald sich ein CIDR ändert; pflegen Sie sie in einer Adressgruppe, ändern Sie sie an einer einzigen Stelle.

## Nächste Schritte {#next-steps}

- [Sicherheitsgruppen](/docs/api/security-groups) — wo auf Adressgruppen verwiesen wird.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — die Netzwerkebene, innerhalb derer Adressgruppen gelten.
