---
title: "Modelo de segurança"
description: "Como chaves, escopos, projetos e logs de auditoria se combinam para limitar o raio de impacto."
publishedAt: 2026-05-20
updatedAt: 2026-10-16
kind: concept
---

# Modelo de segurança

A postura de segurança da NimbusNexus se apoia em quatro pilares: chaves de API são a única forma de autenticação, projetos são a unidade de isolamento, escopos restringem o que cada chave pode fazer e logs de auditoria registram tudo o que importou. Esta página é a visão geral conceitual; cada parte tem sua própria página de referência com os detalhes.

## A fronteira de confiança {#trust-boundary}

Um único projeto é a fronteira de confiança. Dentro de um projeto, todo chamador autorizado pode afetar todos os recursos. Entre projetos, nada pode afetar coisa alguma — os projetos não compartilham redes, não compartilham concessões de IAM, não compartilham cotas.

É assim que foi projetado. Se duas cargas de trabalho precisam ficar isoladas uma da outra (produção de staging, cliente A de cliente B), coloque-as em projetos diferentes. Não tente fazer isolamento com escopos ou rótulos dentro de um único projeto — os escopos restringem o que uma única chave pode fazer, mas uma chave de admin comprometida no projeto continua com alcance total.

## Chaves de API {#api-keys}

A única credencial que a API aceita é uma chave de API. Não há fluxo OAuth por usuário, nem fluxo de assinatura de JWT, nem mTLS — só chaves Bearer. Por que um único mecanismo: cada tipo de credencial a mais aumenta a superfície de ataque (fluxo de emissão, fluxo de revogação, propagação), e preferimos deixar à prova de falhas o único que temos.

As chaves são:

- **Por projeto.** Uma chave com escopo do projeto `acme-prod` não consegue ler nada em `acme-staging`, mesmo na mesma conta.
- **De longa duração, mas rotacionáveis.** Uma chave criada hoje vale até você rotacioná-la ou revogá-la. A rotação tem uma janela de sobreposição de 24 horas para que você implante a nova chave sem interrupção.
- **Criadas apenas pelo painel.** Não há API para criar chaves. Uma chave comprometida não consegue gerar outra chave — a recuperação tem que passar por um canal fora de banda.

Veja [Autenticação](/docs/authentication) para o formato da requisição, a lista de escopos, o fluxo de rotação e os códigos de erro.

## Escopos {#scopes}

Toda chave carrega um conjunto de escopos que limitam o que ela pode fazer dentro do seu projeto. A lista completa espelha os tipos de recurso:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:*`, `block-storage:*`, `object-storage:*`, `iam:*`, ...

Os escopos são um sistema aditivo: uma chave tem a união de todos os escopos que recebeu. Não há negação, nem regras de precedência, nem funções sobre as quais você precise raciocinar.

O padrão certo: **comece restrito e amplie quando falhar**. Crie a chave só com os escopos que você sabe que precisa; deixe a aplicação falhar com `403 forbidden` (`details.reason` é `scope`) se você esqueceu algum e então adicione-o. Isso pega erros do tipo "dei admin ao meu job de CI sem querer" durante o desenvolvimento, não em produção.

## Projetos {#projects}

Os projetos são a primitiva de isolamento mais forte — são a fronteira de recursos, a fronteira de faturamento e a fronteira de controle de acesso. Um usuário com admin no projeto `acme-prod` não vê recursos no projeto `acme-staging`, a menos que também tenha admin (ou qualquer escopo) lá.

A maioria dos times quer **pelo menos um projeto por ambiente** (`prod`, `staging`, `dev`). O motivo: uma chave de dev comprometida não deve conseguir alcançar dados de produção. Melhor ainda: um projeto por combinação de ambiente + serviço (`acme-prod-api`, `acme-prod-batch`), para que o vazamento de uma credencial no job de batch não permita ler dados de clientes da API.

Veja [Projetos](/docs/api/projects) para o formato do recurso e o funcionamento da hierarquia.

## Modelo de rede {#network}

Por padrão, uma VM fica isolada. Para acessar a internet com tráfego de saída, anexe um [IP flutuante](/docs/api/floating-ips) ou coloque-a em uma rede com um roteador. Para aceitar tráfego de entrada, anexe o IP flutuante e (normalmente) coloque um [grupo de segurança](/docs/api/security-groups) na frente, para um firewall stateful.

Não existe rede entre projetos. Uma VM no projeto `acme-prod` não consegue enviar tráfego para uma VM no projeto `acme-staging`, ponto final, nem por IPs privados — o switch virtual subjacente impõe o isolamento no nível do projeto. Se você precisa de comunicação entre projetos (raro), o padrão certo é "exponha uma API pública e chame-a pela internet" — a mesma fronteira de confiança que haveria se as duas cargas de trabalho estivessem em empresas diferentes.

VPC peering e primitivas de rede entre projetos semelhantes podem ser lançados mais tarde; hoje eles não existem, e essa é uma restrição deliberada.

## Logs de auditoria {#audit}

Toda requisição autenticada que altera estado é registrada com:

- `request_id` — o mesmo id que aparece nas respostas de erro
- `key_id` — qual chave fez a chamada (prefixo + 4 últimos caracteres, nunca o segredo completo)
- `user_id` — o usuário que criou a chave
- `operation` — `vms.create`, `database.delete` etc.
- `resource_id` — o recurso afetado
- `project_id` — qual projeto
- `result` — `success`, `validation_error`, `unauthorized` etc.
- `client_ip` — o IP de origem
- `timestamp` — ISO 8601 UTC

Os logs de auditoria ficam disponíveis no painel, com filtro + exportação, e pela API de auditoria do IAM. A retenção é de **365 dias** nos planos Free e Starter, de **2 anos** no Production e configurável no Enterprise.

`GET`s são registrados para recursos marcados como sensíveis (IAM, faturamento, métodos de pagamento); não são registrados em leituras de rotina (listar VMs), para manter o volume de logs administrável. A lista de "leituras sensíveis" está documentada na página de referência de IAM.

## Dados em repouso {#at-rest}

- **Volumes de blocos:** AES-256-XTS com chaves por volume, gerenciadas por nós. Chaves de criptografia gerenciadas pelo cliente (CMK) estão no roadmap; ainda não estão disponíveis.
- **Armazenamento de objetos:** AES-256 do lado do servidor por padrão; SSE-C (chaves fornecidas pelo cliente) e SSE-KMS (CMK via KMS) disponíveis.
- **Backups + snapshots:** a mesma criptografia do volume/objeto de origem.
- **Backups de banco de dados:** a mesma criptografia + a criptografia em repouso do próprio mecanismo de banco de dados, se estiver ativada.

## Dados em trânsito {#in-transit}

Todo o tráfego da API usa TLS 1.3 (TLS 1.2 é aceito; versões mais antigas são rejeitadas no gateway). As conexões de armazenamento de objetos e de bancos de dados usam TLS 1.3, com nossos certificados rotacionados automaticamente. As entregas de webhooks que enviamos a você usam TLS; não aceitamos URLs `http://` simples para endpoints de webhook.

## Reportar uma vulnerabilidade {#disclosure}

Encontrou um problema de segurança? Não abra uma issue no GitHub (ela é pública) e não envie um ticket de suporte comum (a triagem é mais lenta). O [formulário de divulgação de segurança]({{BASE_URL}}/contact/security) vai direto para o time de segurança, aceita conteúdo criptografado com PGP e tem o recebimento confirmado em até 24 horas.

Os termos de safe harbor estão em [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Pesquisas feitas de boa-fé são bem-vindas.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — como chaves, escopos e rotação funcionam na prática.
- [Projetos](/docs/api/projects) — a unidade de isolamento.
- [Webhooks da plataforma](/docs/webhooks) — como proteger as entregas que enviamos aos seus endpoints.
