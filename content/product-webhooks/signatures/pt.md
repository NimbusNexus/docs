---
title: "Verificação de assinatura"
description: "O contrato de assinatura dos webhooks entregues — headers, a construção do HMAC e as três regras para verificá-la."
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Verificação de assinatura

Toda entrega é assinada com o segredo de assinatura do endpoint receptor. Verificar essa assinatura é o que separa "um POST chegou à minha URL" de "a NimbusNexus me enviou este evento" — a URL de um webhook não é um segredo, e qualquer coisa na internet pode encontrá-la.

Esta página é o contrato. Se você usa um dos [SDKs](/docs/product-webhooks/sdks), o helper `verify` dele já implementa tudo isso, e você pode pular para [o que fazer depois de verificar](#responding).

## Os headers {#headers}

| Header | Conteúdo |
|---|---|
| `X-Webhook-Signature` | `sha256=<hex>` — o HMAC que você verifica. **Vários tokens separados por vírgula durante uma rotação de segredo**; veja as [regras](#rules) |
| `X-Webhook-Timestamp` | Segundos Unix; faz parte da assinatura e da janela de replay |
| `X-Webhook-Event-Id` | O id do evento, igual ao `id` no corpo — use-o para deduplicar |
| `X-Webhook-Event-Type` | O tipo do evento |
| `X-Webhook-Delivery-Id` | O id desta entrega; cite-o nas solicitações ao suporte |

> Estes **não** são os headers usados pelos [webhooks da plataforma](/docs/webhooks), que assinam as notificações de infraestrutura com o prefixo `NN-`. Os dois produtos são sistemas separados. Um handler escrito com os nomes de header errados não vai encontrar nada para verificar e vai rejeitar todas as entregas.

## A construção {#construction}

```text
signature = "sha256=" + hex( HMAC_SHA256( secret, "<timestamp>." + raw_body ) )
```

O timestamp, um `.` literal e depois o corpo bruto da requisição — concatenados, passados pelo HMAC com o segredo de assinatura do seu endpoint, codificados em hexadecimal e prefixados com `sha256=`.

Incluir o timestamp no material assinado é o que torna a janela de replay aplicável. Se o timestamp fosse só um header ao lado da assinatura, um atacante que reenviasse uma entrega capturada poderia reescrevê-lo à vontade; assiná-lo significa que qualquer alteração invalida o HMAC.

O corpo em si é JSON compacto, com chaves ordenadas, serializado uma vez no momento da publicação e armazenado. Toda retentativa de uma entrega envia **bytes idênticos** — então uma entrega que só dá certo na quarta tentativa é verificada exatamente como a primeira tentativa seria. Cada tentativa é assinada de novo com um timestamp novo, e é por isso que uma retentativa muito atrasada ainda cai dentro de uma janela de replay curta.

## As três regras {#rules}

**1. Assine os bytes brutos.** Leia o corpo uma vez, como bytes, e verifique esses bytes. Interpretar o JSON e serializá-lo de novo muda a ordem das chaves e os espaços em branco, e a assinatura é sobre o que enviamos, não sobre um objeto equivalente. Esta é, de longe, a causa mais comum de "a assinatura nunca bate" — o payload está certo, e a comparação é feita com bytes diferentes.

Os frameworks que interpretam o JSON automaticamente geralmente expõem o original à parte: `request.body` no Flask, `req.rawBody` com um verify hook no Express, `await request.body()` no FastAPI.

**2. Compare em tempo constante — com todos os tokens.** Use `hmac.compare_digest`, `crypto.timingSafeEqual`, `hmac.Equal` — não `==`. Uma comparação byte a byte que retorna cedo vaza, pelo tempo de resposta, quanto de uma assinatura adivinhada estava certo, o que transforma a falsificação em uma busca viável. Fazer do jeito certo não custa nada; o custo de fazer do jeito errado não aparece nos testes, porque uma implementação errada passa em todos os testes funcionais.

Primeiro divida o header em `,` e aceite se **qualquer** token corresponder. Normalmente há exatamente um token, então isso parece redundante — mas, durante uma rotação do segredo de assinatura, assinamos com o segredo novo e com o anterior e enviamos `sha256=<a>,sha256=<b>`. Um verificador que compara o valor inteiro do header com um único token esperado não corresponde a nenhum dos dois e rejeita **todas** as entregas enquanto durar a sobreposição. Todos os SDKs oficiais dividem o header; quem erra nisso é o verificador feito à mão.

**3. Rejeite timestamps antigos.** Se `X-Webhook-Timestamp` estiver a mais de **300 segundos** do seu relógio, rejeite a entrega, independentemente de o HMAC conferir ou não. Sem isso, uma entrega capturada pode ser usada em um replay para sempre. Com isso, a exposição fica limitada a cinco minutos, mesmo que um payload seja interceptado.

A regra 3 depende de o relógio do seu servidor estar aproximadamente certo. Se as entregas começarem a falhar na verificação em massa depois de uma mudança de infraestrutura, verifique o NTP antes de verificar o seu código.

## Um handler completo {#example}

```python
import hashlib, hmac, time

WINDOW_SECONDS = 300

def verify(secret: str, raw_body: bytes, signature: str, timestamp: str) -> bool:
    # Rule 3 — replay window, checked first because it is the cheapest rejection.
    try:
        if abs(int(time.time()) - int(timestamp)) > WINDOW_SECONDS:
            return False
    except (TypeError, ValueError):
        return False  # absent or non-numeric header

    # Rule 1 — the raw bytes, exactly as received.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # Rule 2 — constant-time comparison against EVERY token. One token normally; several,
    # comma-separated, while a rotation overlap is in effect.
    return any(
        hmac.compare_digest(expected, token.strip())
        for token in signature.split(",")
    )
```

## Responder {#responding}

Retorne um `2xx` e consideramos a entrega feita. Qualquer outra coisa — ou nenhuma resposta dentro do timeout — conta como falha e entra no cronograma de retentativas.

Confirme o recebimento rápido e faça o trabalho depois. Um handler que termina um job lento antes de retornar mantém a entrega aberta e, se passar do timeout, o trabalho acontece *e* a entrega é repetida, gerando justamente a duplicata que você queria evitar. Coloque o trabalho em uma fila, retorne `200` e processe fora da requisição.

Seja idempotente de qualquer forma. A entrega acontece pelo menos uma vez, então conte com receber o mesmo evento duas vezes: deduplique por `X-Webhook-Event-Id`, que é estável em todas as retentativas de uma entrega.

## Rotacionar um segredo {#rotation}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY"
```

O novo segredo é retornado uma vez. Você **não** precisa manter dois segredos no seu handler: por cerca de 24 horas depois de uma rotação, assinamos cada entrega com o segredo novo e com o anterior e enviamos os dois tokens em um só header, `sha256=<new>,sha256=<previous>`. Um verificador que segue a [regra 2](#rules) e confere todos os tokens continua funcionando o tempo todo, qualquer que seja o segredo que ele tenha, então você pode trocar para o novo imediatamente.

A consequência é a armadilha: um verificador que compara o valor inteiro do header funciona bem até a primeira rotação e então rejeita tudo por um dia. Se você rotacionar e as entregas começarem a falhar na verificação em massa, essa comparação é a primeira coisa a verificar.

## Próximos passos {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — helpers `verify` que implementam esta página.
- [Início rápido](/docs/product-webhooks/quickstart) — o fluxo completo do qual isto faz parte.
- [Visão geral de Webhooks](/docs/product-webhooks) — semântica de entrega e a dead-letter queue.
- [Webhooks da plataforma](/docs/webhooks) — as notificações de infraestrutura separadas, assinadas com `NN-`.
