---
title: "Armazenamento de objetos"
description: "Buckets compatíveis com S3, com três classes de armazenamento e transferência gratuita para VMs na mesma região."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Armazenamento de objetos

O armazenamento de objetos da NimbusNexus expõe a **API do AWS S3**. Ferramentas e bibliotecas existentes — a CLI `aws s3`, o boto3, os SDKs oficiais para Java/Go/Node, qualquer framework que fala S3 — funcionam sem alterações depois que você as aponta para o nosso endpoint e coloca as nossas credenciais.

## O que é compatível com S3 e o que não é {#compat}

Implementamos as operações usadas por 90% de quem chama o S3:

- CRUD de buckets (`PutBucket`, `GetBucket`, `DeleteBucket`)
- CRUD de objetos (`PutObject`, `GetObject`, `DeleteObject`, `HeadObject`, `ListObjects`/`ListObjectsV2`)
- Upload multipart (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`)
- URLs pré-assinadas (sig v4)
- Metadados de objetos, content-type, headers personalizados
- Criptografia no lado do servidor (sempre ativa, AES-256)

**Não** implementamos:

- O IAM específico da AWS (temos o nosso — use o modelo de token Bearer descrito em [Autenticação](/docs/authentication) para a API de gerenciamento; as credenciais S3 são emitidas separadamente).
- S3 Object Lock / conformidade WORM (planejado para o 4º trimestre de 2026).
- S3 Select (consulta no lado do servidor).
- Replicação entre regiões pela API do S3 (nós a expomos pela API de gerenciamento, com preços mais claros).

Se o seu app usa uma funcionalidade do S3 que não está na lista de suportadas, ele recebe um `501 Not Implemented` com o nome da operação em `error.code`. Mude para o equivalente suportado ou abra uma solicitação de funcionalidade.

## Classes de armazenamento {#classes}

Três classes, escolhidas na gravação do objeto (ou como padrão do bucket):

| Classe     | Por GB·mês | Latência do primeiro byte | Duração mínima de armazenamento | Quando usar                                                                                                                                                                       |
| ---------- | ------------ | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `standard` | \$0,013    | <50 ms                    | Nenhuma                         | Dados quentes — assets web, leituras frequentes, qualquer coisa servida ao vivo.                                                                                                  |
| `ia`       | \$0,007    | <50 ms                    | 30 dias                         | "Infrequent access" — acessado de vez em quando, mas você quer rapidez quando acessa. O mesmo desempenho de recuperação do Standard, metade da tarifa de armazenamento, uma taxa de recuperação por GB. |
| `cold`     | \$0,004    | 1–60 minutos              | 90 dias                         | Arquivo — backups, logs brutos, retenção para conformidade. Mais barato para manter, mais lento para recuperar.                                                                   |

Duração mínima de armazenamento significa: se você excluir um objeto antes da janela mínima, paga a tarifa por GB pelo restante da janela. É esse o "infrequent" de IA: sai barato se você deixa os objetos parados e caro se fica criando e excluindo.

Para necessidades de puro arquivamento, em que você quase nunca lê os dados, veja o [armazenamento frio]({{BASE_URL}}/cold-storage) — um produto de arquivo dedicado, com tarifas ainda mais baratas (\$0,004/GB·mês fixo, mais as taxas de recuperação).

## Egress, o que realmente muda {#egress}

A maior diferença em relação ao AWS S3 é **como o egress é cobrado**:

- VM ↔ armazenamento de objetos **na mesma região**: **gratuito**, sempre. Esse é o caminho por onde passa o tráfego da maioria das cargas de trabalho — suas VMs falam com seus buckets — e não o cobramos. Egress efetivo para tráfego de produção que fica dentro de uma região: \$0.
- Egress para a internet pública: \$0,009/GB, com o primeiro **1 TB gratuito por mês** por projeto. Para comparação, o AWS S3 cobra \$0,09/GB pelos primeiros 10 TB.
- Egress entre regiões: \$0,005/GB. Mais baixo que o egress para a internet pública porque o caminho passa pelo nosso backbone, não pela internet aberta.

A frase "transferência gratuita para VMs na mesma região" da página de marketing é um compromisso real de arquitetura, não uma promoção. O objetivo é tornar econômicas as arquiteturas multicamadas (o armazenamento de objetos como fonte da verdade, com VMs na frente que leem e servem os dados).

## Nomes de buckets {#naming}

Os nomes de buckets são **únicos globalmente entre todos os tenants da NimbusNexus** — a mesma regra da AWS. Compatíveis com DNS: minúsculas, 3–63 caracteres, sem sublinhados, sem hífens no início ou no fim. A ocupação de nomes de bucket por terceiros é o principal motivo para garantir cedo os nomes importantes.

Os nomes de buckets aparecem na URL: `https://<bucket>.{{S3_HOST_US_EAST_1}}/<key>` ou, no estilo de caminho, em `{{S3_ENDPOINT_US_EAST_1}}/<bucket>/<key>`. Os dois estilos funcionam; os clientes dos SDKs escolhem um conforme a configuração deles.

## Listagem, paginação, desempenho {#listing}

`ListObjectsV2` retorna até 1.000 chaves por requisição, ordenadas lexicograficamente pela chave. Acima de 1.000, pagine com `continuation_token` — igual ao S3.

Para buckets muito largos (milhões de chaves), use a **listagem com delimitador**: passe `delimiter=/` para obter uma listagem no estilo de diretórios, em que as chaves são agrupadas por prefixo. Listar um "diretório" com um delimitador percorre apenas os filhos imediatos dele, não o bucket inteiro.

Objetos da classe Cold aparecem em uma resposta de listagem exatamente como os de Standard / IA — listar não dispara a recuperação; só `GetObject` dispara. Você pode percorrer de graça um bucket Cold com 100 milhões de objetos; restaurar um objeto da classe Cold tem sua própria cobrança por GB.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — autenticação por token Bearer para a API de gerenciamento. As credenciais S3 (chave de acesso + chave secreta) são emitidas separadamente pela API de gerenciamento.
- [Armazenamento em blocos](/docs/api/block-storage) — quando você quer um sistema de arquivos em vez de um armazenamento chave-valor, ou precisa de semântica POSIX.
- [Editor Mosaic]({{BASE_URL}}/products/mosaic) — editor no navegador para arquivos YAML/JSON/Markdown dentro dos seus buckets. Gratuito em toda conta de armazenamento.
