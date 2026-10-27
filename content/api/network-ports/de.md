---
title: "Netzwerkports"
description: "L2/L3-Ports in einem Netzwerk. Der Baustein auf unterer Ebene, an den VM-Schnittstellen und Load Balancer gebunden werden."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-ports
---

# Netzwerkports

Ein Netzwerkport ist der Verbindungspunkt zwischen einem Netzwerk und etwas, das es nutzt — einer VM, einem Load Balancer, einem Router. Die meisten Nutzer verwalten Ports nicht direkt; sie erstellen eine VM mit Netzwerkanbindung, und der Port wird im Hintergrund erstellt. Diese API ist für die Fälle gedacht, in denen Sie direkte Kontrolle brauchen: einen Port + IP vorab zuteilen, bevor Sie eine VM starten, einen Load Balancer an eine bestimmte, bekannte IP anbinden oder eine Service-IP zwischen Hosts migrieren.

Ports haben eine MAC-Adresse, eine oder mehrere IP-Adressen im übergeordneten Subnetz und optional [Sicherheitsgruppen](/docs/api/security-groups), die eingehenden und ausgehenden Traffic filtern. Sie sind zustandsbehaftet — ein Port bleibt bestehen, wenn Sie die VM löschen, an die er angehängt war, und kann an eine Ersatz-VM angehängt werden.

## Nächste Schritte {#next-steps}

- [VM-Schnittstellen](/docs/api/vm-interfaces) — die übergeordnete Schnittstelle „an eine VM anhängen“, die im Hintergrund Ports erstellt.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — worin Ports liegen.
- [Sicherheitsgruppen](/docs/api/security-groups) — was den Traffic von Ports filtert.
