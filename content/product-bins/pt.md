---
title: "Request Bins"
description: "URLs públicas que registram cada requisição HTTP recebida — aponte qualquer app, script ou serviço para uma delas e leia exatamente o que ele enviou, no console ou pela API."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: concept
---

# Request Bins

O NimbusNexus Request Bins oferece **bins**: URLs públicas que registram cada requisição HTTP enviada a elas, com qualquer método, para qualquer caminho sob a URL e com qualquer corpo. Aponte para um bin qualquer coisa que envie HTTP — um provedor de webhooks, o seu próprio app, um script, um job de CI — e leia exatamente o que chegou: o método, o caminho, a query, os headers, o corpo e o endereço de origem, no console ou pela API REST.

> **Não é a página que você procurava?** Um bin registra o que recebe e responde da mesma forma a todos os remetentes. Em um plano pago, ele também pode repassar cada requisição para uma URL sua, tal como ela chegou ([Encaminhamento](/docs/product-bins/forwarding)), mas não verifica assinaturas nem entrega a vários endpoints. Para verificar os webhooks de um provedor e entregá-los como eventos aos seus endpoints, com uma dead-letter queue e reenvio, use uma [fonte de Webhooks](/docs/product-webhooks/sources).

## Em resumo {#at-a-glance}

| | |
| --- | --- |
| O que você cria | Um **bin**: uma URL como `https://nnbin.net/b/k7xq2mbn9tfa` |
| O que ele registra | Cada requisição para essa URL ou para qualquer caminho sob ela, com qualquer método (`GET`, `POST`, o `PROPFIND` do WebDAV, um método próprio do remetente), quaisquer headers e qualquer corpo |
| O que o remetente recebe de volta | `200` e `{"status":"accepted"}`, na hora |
| Encaminhamento | No Starter, no Pro e no Custom, um bin também pode repassar cada requisição para a sua própria URL https ([Encaminhamento](/docs/product-bins/forwarding)) |
| Console | `https://bins.nimbusnexus.net` |
| URL base da API | `https://bins.nimbusnexus.net/v1` |
| Autenticação | `Authorization: Bearer <key>`, uma chave criada no console da conta com **Request Bins** como produto |
| Identificador que toda rota recebe | O `id` do bin, por exemplo `bin_3f9a1c7e5b2d8f4a6c0e9b17` — não a URL dele |
| Encontrar um bin pela URL | `GET /v1/bins?url=<url>` |
| Ler o que chegou | `GET /v1/bins/{id}/requests`, ou `GET /v1/requests` para todos os bins de uma vez (planos pagos; no Free, a leitura é feita no console) |
| Todas as rotas, o que a URL de um bin responde, funções e limites | A [referência de Request Bins](/docs/product-bins/reference) |

## Como funciona {#how}

1. **Crie** um bin — no console, com **Create a bin** (**New bin**, quando você já tiver um), ou com `POST /v1/bins`. A URL dele registra a partir desse momento.
2. **Envie** requisições para ele. Passe a URL a qualquer coisa que você queira observar — as configurações de webhook de um provedor, a configuração do seu app, um script, um job de CI — ou chame a URL você mesmo com `curl`. Tudo o que vem depois do slug é escolha sua: uma requisição para `https://nnbin.net/b/k7xq2mbn9tfa/orders/42` é registrada com o caminho `/orders/42`.
3. **Leia** o que chegou. A requisição aparece no console em segundos e, nos planos pagos, em `GET /v1/bins/{id}/requests`. Para encontrar uma requisição entre muitas, busque um texto nos caminhos, headers e corpos, ou em apenas um deles, em um único header ou em um único campo de um corpo JSON, ou mantenha só alguns métodos: **Search**, **Search in** e os chips de método acima da lista no console, `q`, `in`, `header`, `field` e `method` na API ([Requisições capturadas](/docs/product-bins/reference#requests)). Para ver quais caminhos um remetente usou, alterne a lista para **By path**: ela conta as requisições para cada caminho, e escolher um deles lista essas requisições. `GET /v1/bins/{id}/paths` faz o mesmo na API ([Requisições por caminho](/docs/product-bins/reference#paths)). **All bins** no console, e `GET /v1/requests` na API, listam o que todos os bins registraram em uma única lista, com a mesma busca.
4. **Exclua** o bin quando terminar, ou deixe que ele expire.

O [início rápido](/docs/product-bins/quickstart) faz as quatro etapas.

Use a `url` exatamente como a API a retorna. As URLs de bin ficam em um domínio próprio, `nnbin.net`, e não em `{{ROOT_DOMAIN}}`.

## O que o remetente recebe de volta {#answers}

Um bin responde a toda requisição na hora, com `200` e o corpo `{"status":"accepted"}`, tenha ele registrado a requisição ou não. Um bin desativado, suspenso ou que passou das requisições mensais do plano responde da mesma forma, e o mesmo vale para uma URL cujo bin nunca existiu ou foi excluído. Isso é proposital: um remetente que recebe um erro pode parar de enviar ou desativar o seu webhook, e uma resposta diferente para um bin ativo deixaria qualquer pessoa sondar quais bins existem.

A URL de um bin só responde outra coisa quando nada foi registrado:

- `429`, com `Retry-After`, quando o remetente ou o bin passou do seu limite por minuto;
- `503`, com `Retry-After`, quando a requisição não pôde ser armazenada naquele momento, e por isso o remetente deve enviá-la de novo;
- `404`, quando o slug na URL não poderia ter sido emitido pelo Request Bins.

A referência traz os detalhes: [o que a URL de um bin responde](/docs/product-bins/reference#edge-answers).

## O que é registrado {#recorded}

Para cada requisição, um bin guarda o método, o caminho depois do slug, a query string, os headers na ordem em que chegaram, o corpo, o endereço de origem e quando ela chegou. Algumas regras definem o que você lê de volta:

- **Os corpos são armazenados inteiros, até 1 MiB.** Um corpo maior mantém o primeiro 1 MiB, `truncated` fica `true` e `size_bytes` continua informando o tamanho real.
- **As credenciais são ocultadas.** Os valores de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` e `X-API-Key` são substituídos por `[redacted]` antes que qualquer coisa seja armazenada. Todos os outros headers são mantidos como foram enviados, inclusive os headers de assinatura, já que a assinatura é o que você precisa ver quando a verificação dela falha.
- **Nada é alterado nem executado.** Um corpo é armazenado como os bytes que chegaram, e o console o mostra como texto, nunca como marcação.
- **Toda requisição é uma linha própria.** Uma requisição enviada de novo, com o mesmo método, caminho, query string e corpo, é armazenada de novo, com os seus próprios headers, endereço e horário, de modo que cada retentativa de um remetente pode ser aberta separadamente.

## Encaminhamento {#forwarding}

No Starter, no Pro e no Custom, um bin também pode repassar cada requisição que registra para o seu próprio servidor. Dê a ele uma URL de encaminhamento, e o método, o caminho, a query, os headers e o corpo seguem para essa URL tal como chegaram, enquanto o remetente continua recebendo na hora o `200` do bin. O bin tenta de novo quando o seu servidor falha e guarda o que o seu servidor respondeu junto à requisição, para que você veja o que um remetente enviou e o que o seu endpoint fez com isso. As credenciais não são encaminhadas: os headers que um bin oculta nunca saem dele. [Encaminhamento](/docs/product-bins/forwarding) traz as regras, as retentativas, os limites e o endereço de onde vêm os encaminhamentos.

## Planos e limites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Preço | $0 | $9 por mês, ou $86,40 por ano | $29 por mês, ou $278,40 por ano | por contrato |
| Bins ao mesmo tempo | 1 | 5 | 25 | 250 |
| Requisições registradas por mês | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Mais requisições, compradas com [crédito](#credit) | 10.000 por $4 | 10.000 por $4 | 10.000 por $4 | por contrato |
| Mantidas por (retenção) | 1 dia | 7 dias | 30 dias | 90 dias |
| Tempo de vida do bin | 24 horas | até ser excluído, ou até 7 dias se você definir um | até ser excluído, ou até 30 dias | até ser excluído, ou até um ano |
| Leitura pela API | não (só no console) | sim | sim | sim |
| [Encaminhamento](/docs/product-bins/forwarding), por bin | não | 60 requisições por minuto | 300 requisições por minuto | 600 requisições por minuto |
| Remetentes distintos por bin | 50 | 200 | 500 | 2.000 |
| Envios de formulário de navegador por bin | 3 | 5 | 5 | 10 |

O Free é suficiente para ver exatamente o que qualquer app, script ou serviço envia: um bin, 1.000 requisições por mês, lidas no console.

O mês é um mês do calendário em UTC, e toda requisição que um bin registra conta. Quando as requisições do mês estão acabando, o crédito do seu workspace compra mais, a menos que você desligue isso ([Mais requisições com crédito](#credit)). Sem ele, depois de esgotadas as requisições do mês, os bins continuam respondendo `200` e não registram nada até o início do mês seguinte; as requisições recusadas dessa forma não contam. Um único bin só pode usar parte das requisições do mês, incluindo as compradas — todas no Free, metade no Starter, 40% no Pro e um quarto no Custom — para que uma URL muito movimentada ou vazada não esgote as requisições dos outros bins do workspace.

As duas últimas linhas são limites contra abuso, descritos em [Bins suspensos](#suspended).

### Mais requisições com crédito {#credit}

O crédito é um saldo que o seu workspace mantém para os produtos NimbusNexus gastarem quando o limite mensal deles se esgota. Você o adiciona no [console da conta]({{ACCOUNT_BASE_URL}}/billing#credit), em **Billing**, onde o card **Credit** também liga ou desliga o gasto de cada produto. No Request Bins, esse gasto fica ligado até você desligá-lo.

Quando 90% das requisições do mês já foram usadas e restam menos de 10.000, o Request Bins compra mais 10.000 com crédito, por $4, no Free, no Starter e no Pro, enquanto o saldo durar. No Custom, as requisições adicionais vêm por contrato. As requisições compradas valem pelo resto do mês, inclusive na parcela de cada bin, e expiram quando ele termina: um bloco usado só em parte não é reembolsado. A [referência](/docs/product-bins/reference#credit) traz os detalhes.

## Bins suspensos {#suspended}

A URL de um bin é pública: qualquer pessoa que a tenha pode enviar requisições para ela. Isso faria de um bin um lugar conveniente para coletar o que o formulário de uma página de phishing envia, ou dados tirados das máquinas de desconhecidos, por isso um bin é suspenso quando o tráfego dele tem essa cara:

- ele recebe requisições de mais endereços distintos do que o limite de **remetentes distintos** do plano; ou
- ele recebe mais envios de formulário de navegadores do que o limite de **envios de formulário de navegador** do plano, vindos de pelo menos três endereços.

Um bin suspenso continua respondendo `200` e não registra nada. O console informa o motivo, e o `suspended_code` na API também. A suspensão é decisão nossa, não um interruptor seu: ativar o bin não a remove, então fale com o suporte se você achar que uma suspensão é um erro. Os bins também ficam em espera, sem ser excluídos, quando uma mudança de plano deixa o workspace com mais bins do que o novo plano permite e enquanto o workspace está suspenso por uma cobrança não paga; cada um volta assim que a causa é resolvida.

Para denunciar a URL de um bin que esteja sendo usada de forma abusiva, escreva para `abuse@nnbin.net` com a URL completa.

## Como obter acesso {#access}

Abra o console em `https://bins.nimbusnexus.net` e entre com a sua conta NimbusNexus, ou adicione o Request Bins em **Add a product** em qualquer console NimbusNexus. A primeira visita de um proprietário ou admin do workspace adiciona o Request Bins ao workspace; a partir daí, os outros membros podem abri-lo. Um workspace pessoal começa no Free, e um workspace de time começa com um período de teste de 7 dias do Starter.

As chaves não são emitidas pela API de Request Bins. Crie uma no seu [console da conta]({{ACCOUNT_BASE_URL}}/api-keys?product=bins), em **API keys**, com **Request Bins** como produto. Uma chave é um JWT, por isso começa com `eyJ`. Apresente-a como `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Escolha a permissão dela ao criá-la: **Read** lê os bins e o que eles registraram, e **Read & write** também pode criar, alterar, esvaziar e excluir bins. No Free, uma chave pode gerenciar bins, mas ler pela API o que eles registraram exige o Starter ou superior; o console faz essa leitura em todos os planos. [Quem pode fazer o quê](/docs/product-bins/reference#authority) traz a tabela completa, incluindo as funções do workspace.

## O que ele não faz {#not}

- **Ele não responde com a sua resposta.** Todo bin responde `200` com `{"status":"accepted"}`; responder com um status, headers ou corpo escolhidos por você não foi implementado.
- **Ele não reenvia.** Uma requisição registrada não pode ser enviada de novo sob demanda. O [Encaminhamento](/docs/product-bins/forwarding) repassa cada requisição uma vez, assim que ela chega.
- **Ele não faz push.** Não há stream nem callback: faça polling em `GET /v1/bins/{id}/requests` com `since`, como o console faz a cada 3 segundos.
- **Ele não é um arquivo.** Uma requisição é excluída quando a retenção do plano se esgota, e tudo o que está em um bin é removido quando o bin é excluído ou expira.
- **Ele não divide um workspace por projeto.** O Request Bins atende workspaces inteiros, por isso assentos de convidado e chaves restritas a um projeto são recusados.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-bins/quickstart) — crie um bin, envie uma requisição para ele e leia-a de volta.
- [Encaminhamento](/docs/product-bins/forwarding) — repasse cada requisição ao seu próprio servidor e veja o que ele respondeu.
- [Referência de Request Bins](/docs/product-bins/reference) — todas as rotas e campos, o que a URL de um bin responde, funções, escopos e limites.
- [API de Request Bins](/docs/reference/bins) — todas as operações, com a requisição em curl, TypeScript, Python ou Go.
- [Erros](/docs/errors) — o formato do erro e os códigos que a API envia.
