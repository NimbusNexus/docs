---
title: "Notificações"
description: "Preferências de notificação por conta — sobre o que enviamos e-mails para você e o que encaminhar por webhooks."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: notifications
---

# Notificações

As preferências de notificação controlam quais eventos disparam um e-mail para qual contato e quais disparam uma entrega de webhook no lugar do e-mail (ou além dele). As categorias incluem alertas de faturamento, eventos de segurança, avisos de cota, anúncios de manutenção programada e lançamentos de funcionalidades.

Os padrões são sensatos — as notificações de faturamento e de segurança sempre vão para o contato de faturamento/segurança, independentemente das preferências. As categorias configuráveis são as operacionais: janelas de manutenção, limiares de cota, anúncios de funcionalidades em beta etc.

Para times maiores, o padrão típico é encaminhar as notificações operacionais por webhooks para o seu sistema de gerenciamento de incidentes (PagerDuty, Opsgenie), em vez de mandar e-mail para um único contato. O encaminhamento por webhook aqui usa a mesma semântica de entrega descrita em [Webhooks da plataforma](/docs/webhooks).

## Próximos passos {#next-steps}

- [Webhooks da plataforma](/docs/webhooks) — o canal de entrega para o encaminhamento que não é por e-mail.
- [Visão geral da conta](/docs/api/account-overview) — onde ficam os contatos de faturamento e de segurança.
