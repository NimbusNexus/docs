---
title: "Modelo de segurança"
description: "Como chaves de API, funções, regras de acesso e projetos se combinam para limitar o raio de impacto."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Modelo de segurança

Na API de infraestrutura, três coisas limitam o que uma credencial pode fazer: os projetos são a unidade de isolamento, as funções dizem o que uma chave pode fazer no projeto dela e as regras de acesso restringem as chamadas que ela pode fazer. Esta página é a visão geral conceitual; cada parte tem sua própria página de referência com os detalhes.

## A fronteira de confiança {#trust-boundary}

Um único projeto é a fronteira de confiança. Dentro de um projeto, todo chamador autorizado pode afetar todos os recursos. Entre projetos, nada pode afetar coisa alguma, a menos que você abra essa fronteira: um recurso pertence a um único projeto, as cotas são por projeto e uma chave funciona em um único projeto.

É assim que foi projetado. Se duas cargas de trabalho precisam ficar isoladas uma da outra (produção de staging, cliente A de cliente B), coloque-as em projetos diferentes. Não tente fazer isolamento com regras de acesso dentro de um único projeto: elas restringem o que uma única chave pode fazer, mas outra chave no projeto, com regras mais amplas, continua com alcance total.

## Credenciais {#api-keys}

A API aceita dois tipos de credencial: uma **chave de API** no header `X-API-Key`, para ferramentas e scripts, e uma **sessão conectada**, para uma pessoa no painel.

As chaves são:

- **Por projeto.** Uma chave com escopo do projeto `acme-prod` não consegue ler nada em `acme-staging`, mesmo na mesma conta.
- **Pessoais.** Cada chave pertence à pessoa que a criou e age com funções que essa pessoa tem.
- **Criadas a partir de uma sessão conectada**, no painel ou com `POST /api/v1/api_keys/`.
- **Válidas até você excluí-las**, ou até o `expires_at` que você deu a elas. Não existe chamada de rotação: para substituir uma chave, crie a nova, passe as suas ferramentas para ela e depois exclua a antiga.

Veja [Autenticação](/docs/authentication) para o formato da requisição e os detalhes.

## Funções e regras de acesso {#scopes}

Uma chave age com `roles` no projeto dela, e as `access_rules` dela limitam as chamadas que ela pode fazer: cada regra indica um serviço, um método e um caminho. `unrestricted: true` significa sem regras de acesso, então a chave pode fazer qualquer chamada que as funções dela permitam. Uma chave sem nenhum dos dois só consegue ler a própria sessão.

O padrão certo: **comece restrito e amplie quando falhar**. Crie a chave só com as chamadas de que você sabe que precisa. Uma chamada fora delas recebe `403`, e você cria uma nova chave que a inclua. Isso pega erros do tipo "dei admin ao meu job de CI sem querer" durante o desenvolvimento, não em produção.

## Projetos {#projects}

Os projetos são a primitiva de isolamento mais forte: são a fronteira de recursos e a fronteira de controle de acesso. O faturamento é por workspace. Uma pessoa com uma função no projeto `acme-prod` não vê recursos no projeto `acme-staging`, a menos que também tenha uma função lá.

A maioria dos times quer **pelo menos um projeto por ambiente** (`prod`, `staging`, `dev`). O motivo: uma chave de dev comprometida não deve conseguir alcançar dados de produção. Melhor ainda: um projeto por combinação de ambiente + serviço (`acme-prod-api`, `acme-prod-batch`), para que o vazamento de uma credencial no job de batch não permita ler dados de clientes da API.

Veja [Projetos](/docs/api/projects) para os detalhes.

## Modelo de rede {#network}

Uma VM em uma rede privada não pode ser alcançada pela internet. Para acessar a internet com tráfego de saída, conecte a rede a um [roteador](/docs/api/routers) com um gateway externo. Para aceitar tráfego de entrada, anexe um [IP flutuante](/docs/api/floating-ips). Toda VM tem pelo menos um [grupo de segurança](/docs/api/security-groups), que nega todo o tráfego de entrada até você permiti-lo.

As redes pertencem a um único projeto. Uma VM no projeto `acme-prod` não consegue enviar tráfego para uma VM no projeto `acme-staging` por IPs privados, a menos que você compartilhe uma rede entre eles com o [compartilhamento de rede](/docs/api/network-sharing). Não há peering entre redes de projetos. Fora isso, o padrão é "exponha uma API pública e chame-a pela internet", a mesma fronteira de confiança que haveria se as duas cargas de trabalho estivessem em empresas diferentes.

## Dados em trânsito {#in-transit}

A API é servida por HTTPS. No produto [Webhooks](/docs/product-webhooks), as entregas também usam TLS: a URL de um endpoint precisa ser `https`.

## Reportar uma vulnerabilidade {#disclosure}

Encontrou um problema de segurança? Não abra uma issue no GitHub (ela é pública) e não envie um ticket de suporte comum (a triagem é mais lenta). O [formulário de divulgação de segurança]({{BASE_URL}}/contact/security) vai direto para o time de segurança, aceita conteúdo criptografado com PGP e tem o recebimento confirmado em até 24 horas.

Os termos de safe harbor estão em [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Pesquisas feitas de boa-fé são bem-vindas.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — como chaves, funções e regras de acesso funcionam na prática.
- [Projetos](/docs/api/projects) — a unidade de isolamento.
- [Compartilhamento de rede](/docs/api/network-sharing) — a forma controlada de conectar as redes de dois projetos.
