---
title: "Load Balancer"
description: "Verwaltete Traffic-Verteilung (L4 / L7) über einen Pool von Backend-VMs."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Load Balancer

Ein Load Balancer steht mit einer einzigen VIP (virtuellen IP) vor einer Flotte von VMs, verteilt den Traffic auf die Backends und nimmt fehlerhafte Backends automatisch aus der Rotation. Ein Listener spricht `TCP`, `UDP`, `SCTP`, `HTTP`, `HTTPS`, `TERMINATED_HTTPS` oder `PROMETHEUS` und schickt seinen gesamten Traffic an seinen Standard-Pool; Routing-Regeln nach Pfad oder Header gibt es nicht.

## Die vier Unterressourcen {#sub-resources}

Ein Load Balancer ist selbst ein Container; die Routing-Logik steckt in verschachtelten Ressourcen:

- **Listener** — einer pro (Protokoll, Port), auf dem der LB Traffic annimmt. `HTTPS:443` ist ein Listener; `HTTP:80` ist ein weiterer. Ein einzelner LB kann viele Listener haben.
- **Pool** — eine Gruppe von Backends, an einen Listener (`listener_id`) oder an den Load Balancer (`loadbalancer_id`) gebunden. Jeder Pool hat ein `protocol` (`HTTP`, `HTTPS`, `TCP`, `UDP`, `SCTP`, `PROXY` oder `PROXYV2`) und einen `lb_algorithm`: `ROUND_ROBIN`, `LEAST_CONNECTIONS`, `SOURCE_IP` oder `SOURCE_IP_PORT`. Eine Einstellung für Session-Persistenz gibt es nicht.
- **Member** — ein Backend in einem Pool: eine IP in `address` und ein `protocol_port`, mit einem `weight` (0–256, Standard 1).
- **Health monitor** — der aktive Health-Check pro Pool. Fehlerhafte Member werden aus der Rotation genommen, bis sie sich erholen.

Jede dieser Ressourcen hat eigene Endpoints, die unten aufgeführt sind: `/api/v1/loadbalancers/`, `/api/v1/listeners/`, `/api/v1/pools/`, `/api/v1/pools/{pool_id}/members/` und `/api/v1/health_monitors/`.

## SSL-Terminierung {#ssl}

Für HTTPS-Listener haben Sie zwei Möglichkeiten:

- **TLS wird am LB terminiert.** Verwenden Sie einen Listener vom Typ `TERMINATED_HTTPS` und richten Sie `default_tls_container_ref` (und für weitere Zertifikate `sni_container_refs`) auf einen bestehenden Zertifikatscontainer. Der LB spricht TLS mit den Clients und Klartext mit Ihren VMs. Diese API lädt keine Zertifikate hoch und stellt keine aus.
- **TLS-Passthrough.** Der LB leitet nur auf L4 per TCP weiter; Ihre VMs übernehmen TLS. Erforderlich, wenn das Backend das ursprüngliche Client-Zertifikat sehen muss. Verwenden Sie einen Listener vom Typ `HTTPS` oder `TCP`.

## Health-Checks {#health-checks}

Ein Health Monitor prüft jeden Member alle `delay` Sekunden und wartet `timeout` Sekunden, weniger als `delay`, auf eine Antwort; beide Werte legen Sie fest. Sein `type` ist `HTTP`, `HTTPS`, `PING`, `TCP`, `TLS-HELLO`, `UDP-CONNECT` oder `SCTP`. `GET /api/v1/loadbalancers/{loadbalancer_id}/status` zeigt den `operating_status` jedes Members.

- Ein Member wird nach `max_retries_down` fehlgeschlagenen Prüfungen aus der Rotation genommen (nach 3, wenn Sie den Wert weglassen).
- Nach `max_retries` erfolgreichen Prüfungen ist er wieder in der Rotation; diesen Wert müssen Sie setzen.

Bei Checks vom Typ HTTP und HTTPS setzen Sie `url_path`, `http_method` und `expected_codes`. Richten Sie `url_path` auf etwas in Ihrer App, das schnell einen Body zurückgibt — und lassen Sie den Check keine echte Arbeit erledigen, sonst wird der Check selbst zur Last.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — was zu Membern eines Pools wird.
- [Floating-IPs](/docs/api/floating-ips) — Alternative für den öffentlichen Zugriff auf eine einzelne VM ohne LB.
- [Sicherheitsgruppen](/docs/api/security-groups) — die Firewall an der VM-Schnittstelle; LBs beachten die Sicherheitsgruppen der Member.
