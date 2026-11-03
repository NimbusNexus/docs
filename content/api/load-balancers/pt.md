---
title: "Balanceadores de carga"
description: "Distribuição gerenciada de tráfego L4 / L7 entre um pool de VMs de backend."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Balanceadores de carga

Um balanceador de carga fica na frente de uma frota de VMs com um único VIP (IP virtual), distribuindo o tráfego entre os backends e tirando automaticamente de rotação os que não estão saudáveis. Um listener fala `TCP`, `UDP`, `SCTP`, `HTTP`, `HTTPS`, `TERMINATED_HTTPS` ou `PROMETHEUS` e envia todo o seu tráfego para o seu pool padrão; não existem regras de roteamento por caminho ou por header.

## Os quatro sub-recursos {#sub-resources}

Um balanceador de carga é, ele próprio, um contêiner; a lógica de roteamento fica em recursos aninhados:

- **Listener** — um por (protocolo, porta) em que o LB aceita tráfego. `HTTPS:443` é um listener; `HTTP:80` é outro. Um único LB pode hospedar muitos listeners.
- **Pool** — um grupo de backends, vinculado a um listener (`listener_id`) ou ao balanceador de carga (`loadbalancer_id`). Cada pool tem um `protocol` (`HTTP`, `HTTPS`, `TCP`, `UDP`, `SCTP`, `PROXY` ou `PROXYV2`) e um `lb_algorithm`: `ROUND_ROBIN`, `LEAST_CONNECTIONS`, `SOURCE_IP` ou `SOURCE_IP_PORT`. Não existe uma configuração de persistência de sessão.
- **Membro** — um backend em um pool: um `address` IP e uma `protocol_port`, com um `weight` (0–256, padrão 1).
- **Monitor de integridade** — a verificação de integridade ativa de cada pool. Os membros que falham saem de rotação até se recuperarem.

Cada um tem os seus próprios endpoints, listados abaixo: `/api/v1/loadbalancers/`, `/api/v1/listeners/`, `/api/v1/pools/`, `/api/v1/pools/{pool_id}/members/` e `/api/v1/health_monitors/`.

## Terminação SSL {#ssl}

Para listeners HTTPS, você tem duas opções:

- **TLS terminado no LB.** Use um listener `TERMINATED_HTTPS` e aponte `default_tls_container_ref` (e `sni_container_refs`, para mais certificados) para um contêiner de certificados existente. O LB serve TLS para os clientes enquanto fala em texto puro com as suas VMs. Esta API não envia nem emite certificados.
- **TLS passthrough.** O LB faz apenas encaminhamento TCP L4; suas VMs cuidam do TLS. Obrigatório quando o backend precisa ver o certificado original do cliente. Use um listener `HTTPS` ou `TCP`.

## Verificações de integridade {#health-checks}

Um monitor de integridade testa cada membro a cada `delay` segundos e espera `timeout` segundos, menos que `delay`, por uma resposta; você define os dois. O `type` dele é `HTTP`, `HTTPS`, `PING`, `TCP`, `TLS-HELLO`, `UDP-CONNECT` ou `SCTP`. `GET /api/v1/loadbalancers/{loadbalancer_id}/status` mostra o `operating_status` de cada membro.

- Um membro sai de rotação depois de `max_retries_down` sondagens com falha (3, se você não o definir).
- Ele volta à rotação depois de `max_retries` sondagens bem-sucedidas, que você precisa definir.

Nas verificações HTTP e HTTPS, defina `url_path`, `http_method` e `expected_codes`. Aponte `url_path` para algo no seu app que retorne um corpo rápido — e evite que a verificação faça trabalho real, senão a própria verificação vira a carga.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o que vira membro de pool.
- [IPs flutuantes](/docs/api/floating-ips) — alternativa para acesso público a uma única VM, sem LB.
- [Grupos de segurança](/docs/api/security-groups) — o firewall na interface da VM; os LBs respeitam os grupos de segurança dos membros.
