---
title: "Balanceadores de carga"
description: "Distribuição gerenciada de tráfego L4 / L7 entre um pool de VMs de backend."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Balanceadores de carga

Um balanceador de carga fica na frente de uma frota de VMs com um único VIP (IP virtual), distribuindo o tráfego entre os backends e tirando automaticamente de rotação os que não estão saudáveis. Dois tipos: **L4** (TCP / UDP / proxy-protocol) e **L7** (HTTP / HTTPS com roteamento por caminho + header).

## Os quatro sub-recursos {#sub-resources}

Um balanceador de carga é, ele próprio, um contêiner; a lógica de roteamento fica em recursos aninhados:

- **Listener** — um por (protocolo, porta) em que o LB aceita tráfego. `HTTPS:443` é um listener; `HTTP:80` é outro. Um único LB pode hospedar muitos listeners.
- **Pool** — um grupo de VMs de backend, definido por listener. Cada pool tem um algoritmo (`round-robin`, `least-connections`, `source-ip-hash`) e uma política de persistência de sessão.
- **Membro** — um backend em um pool. Referencia uma VM + porta + peso.
- **Monitor de integridade** — a verificação de integridade ativa de cada pool. Os membros que falham saem de rotação até se recuperarem.

Os endpoints abaixo operam sobre o balanceador de carga de nível superior. O CRUD aninhado de listeners/pools/membros/monitores de integridade fica em `/v1/load-balancers/{id}/listeners` etc. (fora desta amostra mínima — coberto na especificação ao vivo).

## Terminação SSL {#ssl}

Para listeners HTTPS, você tem duas opções:

- **TLS terminado no LB.** Envie um certificado (ou use o Let's Encrypt pelo add-on cert-manager), e o LB serve TLS para os clientes enquanto fala em texto puro com as suas VMs. É mais fácil de gerenciar e permite que o LB inspecione os headers HTTP para o roteamento L7.
- **TLS passthrough.** O LB faz apenas encaminhamento TCP L4; suas VMs cuidam do TLS. Obrigatório quando o backend precisa ver o certificado original do cliente.

## Verificações de integridade {#health-checks}

Um monitor de integridade testa cada membro periodicamente (por padrão, a cada 10 s) em um caminho / porta configurado. Três resultados:

- **Healthy** (saudável) — as 2 últimas sondagens tiveram sucesso (padrão; configurável). O membro recebe tráfego.
- **Unhealthy** (não saudável) — as 3 últimas sondagens falharam (configurável). O membro sai de rotação; as conexões atuais são drenadas.
- **Recovering** (em recuperação) — estava não saudável e agora volta a passar. Depois de 2 sondagens bem-sucedidas, passa para saudável.

Nas verificações de integridade HTTP, o LB envia um GET para `/healthz` (configurável) e espera 200. Implemente `/healthz` no seu app para retornar um corpo rápido — e evite que a verificação faça trabalho real, senão a própria verificação vira a carga.

## Preços {#pricing}

Os balanceadores de carga são cobrados a uma tarifa fixa por hora por região (\$0,024/h no tier standard, na referência de preços EN). Criar listeners / pools / membros / monitores de integridade é gratuito. O tráfego entre LBs de regiões diferentes conta como egress padrão entre regiões.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o que vira membro de pool.
- [IPs flutuantes](/docs/api/floating-ips) — alternativa para acesso público a uma única VM, sem LB.
- [Grupos de segurança](/docs/api/security-groups) — o firewall na interface da VM; os LBs respeitam os grupos de segurança dos membros.
