---
title: "Bancos de dados gerenciados"
description: "Postgres, MySQL, MongoDB, Redis, Kafka e OpenSearch gerenciados — provisione, faça snapshots, restaure."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Bancos de dados gerenciados

A NimbusNexus roda seis mecanismos de banco de dados como serviços gerenciados. Nós cuidamos do trabalho operacional — failover, backups, upgrades de versões secundárias, patches do SO — e você recebe uma string de conexão e o protocolo nativo do mecanismo do outro lado. **Nenhum formato de transmissão proprietário, nenhuma biblioteca cliente especial obrigatória**: conecte-se com `psql`, `mongo`, o cliente oficial do Kafka etc.

## Mecanismos {#engines}

| Mecanismo    | Para que serve                                                                             | Tamanho inicial |
| ------------ | --------------------------------------------------------------------------------------- | ------------- |
| `postgres`   | Carga de trabalho transacional, o padrão seguro para "preciso de um banco de dados".       | `db-1-4`        |
| `mysql`      | Quando o app ou o time já usa MySQL. PostgreSQL é o padrão certo para trabalhos novos.     | `db-1-4`        |
| `mongodb`    | Carga de trabalho de documentos, schemas dinâmicos, semântica de replica set.              | `db-2-8`        |
| `redis`      | Cache, armazenamento de sessões, pub/sub, filas. Sem interface SQL.                        | `db-1-2`        |
| `kafka`      | Streaming de eventos, agregação de logs, pub/sub durável. Mínimo de três brokers.          | `db-2-8` × 3    |
| `opensearch` | Busca de texto completo, análise de logs.                                                  | `db-4-16`       |

Os códigos de tamanho seguem a mesma convenção das VMs (`db-<vCPU>-<RAM_GB>`), com um multiplicador de preço separado por mecanismo — o Redis é mais barato que o Postgres no mesmo hardware porque não há WAL em disco; o MongoDB é mais caro por causa do custo adicional de licenciamento do replica set.

## Ciclo de vida {#lifecycle}

Os bancos de dados passam por cinco estados:

- `provisioning` — instância(s) subindo. 60–120 segundos para mecanismos de nó único (Postgres, MySQL, Redis), 90–180 segundos para os replicados (MongoDB, Kafka, OpenSearch).
- `running` — aceitando conexões na string de conexão publicada.
- `maintenance` — aplicando um upgrade secundário ou um patch. As conexões sobrevivem; o banco de dados fica brevemente indisponível durante o cutover (normalmente <5 segundos para Postgres/MySQL, mais para Kafka).
- `stopping` → `stopped` — pausado. Você deixa de pagar pela computação; o armazenamento continua sendo cobrado. Reinicie a qualquer momento.
- `terminated` — destruído.

O estado é informado em toda resposta de GET, no campo `state`. Transições de longa duração (provisionamento inicial, upgrade de versão) informam o progresso em um objeto `operation` embutido — veja [Convenções](/docs/conventions).

## Backups e snapshots {#backups}

Dois métodos de backup funcionam lado a lado:

- **Backup contínuo do WAL** (somente Postgres, MySQL). Ativado por padrão. Enviamos o write-ahead log para o armazenamento de objetos a cada ~5 segundos e podemos restaurar para qualquer momento dos últimos 7 dias. **Recuperação para um ponto no tempo**.
- **Snapshots sob demanda** (todos os mecanismos). Disparados por `POST /v1/databases/{id}/snapshots`. Consistentes (sem precisar suspender o I/O), guardados no armazenamento de objetos, restauráveis para um novo banco de dados na mesma região.

Os snapshots são independentes do banco de dados de origem — destruir a origem preserva os snapshots. A retenção é de 7 dias por padrão; aumente-a pelo painel ou passando `retention_days` na requisição do snapshot.

## Conexões {#connections}

A resposta de GET de cada banco de dados inclui um objeto `connection`:

```json
{
  "connection": {
    "host": "{{DB_HOST_DEMO}}",
    "port": 5432,
    "database": "main",
    "username": "nimbus",
    "password_secret": "secret://projects/.../database-passwords/db_01H8FZ...",
    "ssl": "require"
  }
}
```

A senha é referenciada como uma URL de segredo, não incluída diretamente — busque-a em `GET /v1/secrets/{secret-id}` e guarde-a em cache durante o tempo de vida da conexão. Isso mantém os valores das senhas fora de qualquer log que capture os registros completos dos bancos de dados.

Todos os bancos de dados exigem TLS nas conexões dos clientes. Certificados autoassinados não são aceitos; publicamos o bundle da CA em `/v1/databases/ca-bundle.pem`. Clientes Postgres / MySQL devem usar `sslmode=verify-full` e apontar `sslrootcert` para o bundle.

## Versões e upgrades {#versions}

- **Versões secundárias** são aplicadas automaticamente durante a janela de manutenção semanal (domingo, das 02:00 às 04:00 na região do banco de dados, configurável). Sem downtime para Postgres/MySQL com WAL contínuo; mecanismos com replica set passam por um breve failover.
- **Versões principais** exigem uma chamada explícita a `POST /v1/databases/{id}/upgrade`. Testamos o upgrade com os seus dados em um snapshot antes de trocar o primário, então um upgrade que falha vira um rollback, não uma corrupção.

As versões principais têm suporte por pelo menos 24 meses após o lançamento upstream. Publicamos os cronogramas de fim de vida no changelog com pelo menos 90 dias de antecedência.

## Observações sobre preços {#pricing}

- Computação: por segundo, por equivalente de vCPU, com um multiplicador por mecanismo (veja a [página de preços]({{BASE_URL}}/managed-databases)).
- Armazenamento: \$0,18/GB·mês (NVMe Performance, o padrão).
- Backups: \$0,04/GB·mês no tier de snapshots.
- Replicação entre regiões (onde houver suporte): medida como egress padrão entre regiões (\$0,005/GB).
- Sem taxa por conexão, sem cobrança por IOPS, sem cobrança por eventos de failover.

O preço inicial anunciado é \$19/mês por um Postgres `db-1-4` na Virgínia — uma instância de 1 vCPU / 4 GB / 50 GB, o menor tamanho razoável para cargas de trabalho de produção.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) para o padrão de token Bearer que todos os endpoints compartilham.
- [Convenções](/docs/conventions) para entender como funcionam as operações, a paginação e os erros.
- [Armazenamento em blocos](/docs/api/block-storage) — se você roda seu próprio banco de dados em uma VM, este é o disco em que ele fica.
- O artigo **Postgres / MySQL / Mongo / Redis: quando usar cada um** em [Recursos](/resources/postgres-mysql-mongo-redis-when-to-use) — guia para escolher o mecanismo.
