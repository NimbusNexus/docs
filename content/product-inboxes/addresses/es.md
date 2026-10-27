---
title: "Direcciones y la frase"
description: "Por qué una dirección desechable rechaza el correo cuyo asunto no lleva su frase, y en qué se diferencian la caducidad, la retención y el borrado."
publishedAt: 2026-08-18
updatedAt: 2026-10-19
kind: concept
---

# Direcciones y la frase

Una dirección desechable es pública por su propia naturaleza: va a acabar en un formulario de registro, en un log de CI, quizá en una captura de pantalla. Cualquiera que la vea puede enviarle correo. Esta página trata de los dos mecanismos que hacen que eso sea seguro — la **frase**, y el hecho de que las direcciones **mueren**.

## La frase {#phrase}

Un inbox del plan gratuito siempre recibe un token corto junto con su dirección. En Starter, Pro y Custom solo recibe uno si lo pides, con `"phrase": true` al crearlo o en un `PATCH` posterior. Un inbox con frase solo acepta un mensaje si la frase aparece en el **asunto**; uno sin frase acepta cualquier asunto:

```text
Subject: nn-re89dr Your verification code   ← accepted
Subject: Your verification code             ← refused
```

La frase no es una contraseña ni un secreto — viaja en texto plano en la línea del asunto. Lo que es, es *un estorbo con forma de secreto compartido*: significa que una dirección filtrada no es, por sí sola, una dirección utilizable.

Esa distinción es el producto. Sin ella, una dirección desechable encontrada en un log público de CI podría usarse para registrar cuentas en otros servicios, recibir sus correos de confirmación y dar a alguien una cuenta que tú no puedes ver y que no creaste. La dirección sería un generador gratuito de identidades anónimas. Exigir la frase significa que quien tenga la dirección también tiene que haber recibido la frase de la misma llamada a la API que la emitió — y quien rastrea la salida de tu compilación no la ha recibido.

También significa que **tú controlas lo que acepta la dirección**. Un sistema bajo prueba que configuras tú pondrá la frase en el asunto porque se lo has dicho. Un envío oportunista, no.

Dónde ponerla: en cualquier parte del asunto. La comparación se hace solo con el asunto — una frase en el cuerpo no cuenta, porque el cuerpo es la parte que un atacante puede rellenar con cualquier cosa con más facilidad.

## El rechazo es visible {#refusal}

El correo que no cumple alguna regla de aceptación se rechaza **durante la conversación SMTP**, no se acepta y se oculta:

- la dirección es desconocida, ha caducado, se ha borrado o está desactivada;
- el inbox tiene frase y el asunto no la contiene;
- el workspace ha superado su cupo mensual;
- el mensaje supera los 5 MiB.

Esto importa más de lo que parece. La alternativa — aceptar y luego descartar en silencio — produce un inbox vacío que parece exactamente un emisor que nunca envió nada. Rechazar en la puerta significa que el emisor recibe un rechazo que puede registrar, y un inbox vacío en tu test significa que *no se envió nada*, que es un fallo distinto de *se envió algo y se rechazó*.

El correo rechazado nunca se guarda ni cuenta para el consumo.

## Tres formas de que termine una dirección {#lifecycle}

Es fácil confundirlas, y se comportan de forma distinta.

| | Qué ocurre | Reversible |
| --- | --- | --- |
| **Caducidad** | La dirección llega a `expires_at`, se retira y su correo guardado se borra. | No |
| **Borrar** | La terminas antes de tiempo con `DELETE /v1/inboxes/{id}`. Se retira de inmediato, igual que con la caducidad. | No |
| **Desactivar** | La dirección deja de aceptar correo y conserva lo que ya tiene. | Sí — vuelve a activarla |

Una dirección retirada **nunca se vuelve a emitir**, ni para ti ni para nadie: se registra cada dirección que ha existido, y cada nueva se comprueba contra ese registro antes de emitirse. Es una propiedad de seguridad, no un detalle de implementación — reciclar una dirección desechable acabaría entregando el restablecimiento de contraseña de un desconocido en la ejecución de tests de otra persona. Las direcciones no se agotan: una dirección son 12 caracteres de un alfabeto de 32, unas 1,15 × 10¹⁸ combinaciones.

Recurre a **desactivar** cuando una suite de tests esté inundando una dirección y quieras que pare durante una hora. Recurre a **borrar** cuando hayas terminado y quieras recuperar el hueco — los planes limitan cuántas direcciones puedes tener a la vez. Las versiones anteriores de esta documentación, y el registro de auditoría de la API, llaman *release* a borrar.

## La caducidad no es la retención {#expiry-vs-retention}

Son dos relojes distintos, y confundirlos es la causa habitual de "mi mensaje ha desaparecido":

- La **caducidad** (`expires_at`) es cuánto vive la **dirección**.
- La **retención** es cuánto tiempo sigue siendo legible un **mensaje** aceptado, y la fija tu plan.

Gana el más corto. En un plan con retención de 24 horas, un mensaje recibido hoy ya no se puede leer mañana aunque la propia dirección viva una semana. Cuando la dirección caduca, todo lo que contiene desaparece a la vez, sea cual sea la retención.

El borrado es real. No hay archivo histórico ni forma de recuperar lo borrado, así que un test que compruebe correo más antiguo que su ventana de retención fallará de una forma que parece un problema de entrega y no lo es.

## Las direcciones están en su propio dominio {#domain}

Las direcciones creadas están en un dominio dedicado a los inboxes, no en `{{ROOT_DOMAIN}}` ni en el tuyo. Es deliberado: un dominio que acumula tráfico de direcciones desechables acumula la reputación que lo acompaña, y mantenerla lejos del dominio desde el que sale tu correo real compensa un registro DNS de más.

La consecuencia práctica es que nunca debes deducir el dominio de la dirección a partir del dominio del producto. Lee `address` de la respuesta de creación y úsala tal cual.
