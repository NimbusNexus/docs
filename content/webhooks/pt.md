---
title: "Webhooks da plataforma"
description: "Inscreva-se nos eventos de ciclo de vida da sua infraestrutura. POSTs assinados com HMAC para uma URL que você controla."
publishedAt: 2026-05-20
updatedAt: 2026-08-05
kind: concept
---

# Webhooks da plataforma

Os webhooks da plataforma são a forma como a NimbusNexus avisa seus sistemas quando algo muda — uma VM termina o provisionamento, um snapshot é concluído, uma fatura é gerada. Você registra uma URL; enviamos um payload JSON por POST para ela toda vez que o evento correspondente dispara.

> **Procurando o produto Webhooks?** Se você quer enviar webhooks para os *seus próprios* clientes — publicar um evento e deixar que nós assinemos, repitamos e reenviemos cada entrega —, esse é um produto separado, documentado em [Webhooks (produto)](/docs/product-webhooks). Esta página trata apenas das notificações que a NimbusNexus envia *a você* sobre a sua própria infraestrutura. **Os dois usam headers de assinatura diferentes**, então o código de verificação não é intercambiável.

Os webhooks permitem reagir a mudanças de estado sem polling. O polling funciona, mas é um desperdício em escala (a maioria das requisições retorna "nada mudou") e é lento em pequena escala (você só fica sabendo de uma mudança no próximo ciclo de polling). Os webhooks invertem o modelo — avisamos você no momento em que algo acontece.

## Como é uma entrega {#delivery}

```http
POST /webhooks/nimbusnexus HTTP/1.1
Host: your-app.example.com
Content-Type: application/json
NN-Event: vm.created
NN-Delivery-Id: del_01HG7Y3...
NN-Timestamp: 1763410800
NN-Signature: sha256=4d2c8f19e6b07d3f...

{
  "event": "vm.created",
  "occurred_at": "2026-05-20T18:30:00Z",
  "data": {
    "id": "vm_01HG7Y3...",
    "name": "web-01",
    "state": "running",
    "ipv4": "203.0.113.5"
  }
}
```

Toda entrega traz quatro headers:

- `NN-Event` — o tipo de evento (`vm.created`, `snapshot.completed` etc.)
- `NN-Delivery-Id` — único por entrega; pode ser usado com segurança como chave de idempotência do seu lado
- `NN-Timestamp` — segundos de epoch Unix no momento da entrega; usado na assinatura
- `NN-Signature` — HMAC-SHA256 sobre `{timestamp}.{body}`, codificado em hex

## Verificar a assinatura {#signature}

A assinatura prova que a entrega veio da NimbusNexus, e não de alguém que adivinhou a URL do seu webhook. Verifique-a no seu handler antes de fazer qualquer trabalho:

```ts
import crypto from 'node:crypto'

function verifyWebhook(req: Request, secret: string): boolean {
  const timestamp = req.headers.get('NN-Timestamp')!
  const signature = req.headers.get('NN-Signature')!.replace(/^sha256=/, '')
  const body = req.bodyText // raw body, not parsed JSON

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  // Constant-time compare avoids timing oracles
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
```

O segredo vem do painel, no momento da criação do endpoint de webhook. Guarde-o no seu gerenciador de segredos, não no código-fonte — ele permite que qualquer pessoa forje entregas.

Rejeite também entregas com um timestamp que difira em mais de 5 minutos do relógio do seu servidor. Isso limita a janela de replay se o segredo algum dia vazar.

## Tipos de evento {#events}

Todo recurso que tem um ciclo de vida emite eventos. Os mais comuns:

| Evento | Quando |
|---|---|
| `vm.created` | Uma VM terminou o provisionamento e está `running` |
| `vm.state_changed` | Uma VM passou de um estado para outro, quaisquer que sejam |
| `vm.deleted` | Uma VM foi encerrada |
| `snapshot.completed` | Um snapshot terminou de ser copiado |
| `backup.completed` | Um backup agendado terminou |
| `database.upgrade_completed` | Um upgrade do mecanismo de um banco de dados gerenciado terminou |
| `floating_ip.attached` / `floating_ip.detached` | Mudanças na anexação |
| `invoice.generated` | Uma fatura mensal foi finalizada |
| `payment.succeeded` / `payment.failed` | Resultados de pagamento |
| `quota.warning` | O projeto passou de 90% de alguma cota |

A lista completa de tipos de evento está na referência da API de cada recurso (o campo `events` do recurso mostra o que é emitido).

## Semântica de entrega {#delivery-semantics}

- **Pelo menos uma vez.** Uma rede instável ou um handler lento podem nos levar a tentar de novo. Use `NN-Delivery-Id` para deduplicar do seu lado.
- **A ordem não é garantida.** Dois eventos disparados com ~1 segundo de diferença podem chegar fora de ordem. O campo `occurred_at` no payload informa a ordem real; ordene por ele se isso importar.
- **Retentativas:** entregas que falham (resposta fora de 2xx, ou timeout > 10 s) são repetidas com backoff exponencial em 1, 5, 25, 125 e 625 segundos. Cinco tentativas no total. Depois disso, a entrega é descartada; ela aparece no quadro "failed deliveries" do painel por 14 dias.
- **Timeout:** seu handler tem 10 segundos para retornar um 2xx. Se precisar fazer mais trabalho, coloque-o em uma fila e confirme o recebimento do webhook imediatamente.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — como funcionam as chaves de API (não os segredos de webhook).
- [Idempotência](/docs/idempotency) — o padrão que esta página recomenda para lidar com retentativas.
- [Convenções](/docs/conventions) — formatos de erro, códigos de status e o resto do formato da requisição.
