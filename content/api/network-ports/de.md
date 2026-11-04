---
title: "Netzwerkports"
description: "L2/L3-Ports in einem Netzwerk. Der Baustein auf unterer Ebene, an den VM-Schnittstellen und Load Balancer gebunden werden."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-ports
---

# Netzwerkports

Ein Netzwerkport ist der Verbindungspunkt zwischen einem Netzwerk und etwas, das es nutzt — einer VM, einem Load Balancer, einem Router. Die meisten Nutzer verwalten Ports nicht direkt; sie erstellen eine VM mit Netzwerkanbindung, und der Port wird im Hintergrund erstellt. Diese API ist für die Fälle gedacht, in denen Sie direkte Kontrolle brauchen: einen Port mit bekannter IP erstellen und an eine laufende VM anhängen, einen Load Balancer an eine bestimmte, bekannte IP anbinden oder eine Service-IP zwischen Hosts migrieren.

Ports haben eine MAC-Adresse, eine oder mehrere IP-Adressen im übergeordneten Subnetz und optional [Sicherheitsgruppen](/docs/api/security-groups), die eingehenden und ausgehenden Traffic filtern. Ein Port, den Sie selbst erstellen, überdauert die VM, an die er angehängt ist, und steht für eine Ersatz-VM bereit; die Ports, die eine VM beim Erstellen in einem Netzwerk erhält, werden mit ihr gelöscht. Ein Port im externen Netzwerk wird abgerechnet, bis Sie ihn löschen (siehe [Preisdaten](/docs/api/pricing-data)).

Beim Erstellen einer VM geben Sie nur Netzwerke an (`network`); ein Port, den Sie erstellt haben, kommt deshalb erst nach dem Start zu einer VM: mit `POST /api/v1/instance/{server_id}/interfaces/` und seiner `port_id`.

## Nächste Schritte {#next-steps}

- [VM-Schnittstellen](/docs/api/vm-interfaces) — die übergeordnete Schnittstelle „an eine VM anhängen“, die im Hintergrund Ports erstellt.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — worin Ports liegen.
- [Sicherheitsgruppen](/docs/api/security-groups) — was den Traffic von Ports filtert.
