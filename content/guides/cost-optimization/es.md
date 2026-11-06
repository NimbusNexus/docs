---
title: "Optimiza tu factura mensual"
description: "A dónde va la factura de tu infraestructura y cómo encontrar los recursos por los que puedes dejar de pagar."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Optimiza tu factura mensual

Lo que pagas en NimbusNexus es, sobre todo, lo que tienes asignado, lo estés usando o no: VMs, volúmenes, IPs flotantes, puertos públicos y su ancho de banda, e imágenes personalizadas. Así que, cuando una factura sea mayor de lo que esperabas, busca primero lo que sigue asignado y ya no necesitas. Esta guía recorre esos sitios, con las llamadas para encontrar cada uno.

En [Datos de precios](/docs/api/pricing-data) están los precios. La facturación es por workspace, mientras que una clave de API funciona en un proyecto, así que repite estas llamadas en cada proyecto del workspace.

## Requisitos previos {#prereqs}

- `curl` y `jq`, con `$NIMBUS_KEY` definida con una [clave de API](/docs/authentication) que pueda hacer estas llamadas.

```bash
export NIMBUS_KEY="<your-api-key>"
```

Las llamadas de abajo que borran o cambian algo usan los ids que imprimen las listas, como `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` y `$PORT_ID`.

## 1 · VMs detenidas de las que te has olvidado {#stopped-vms}

Detener una VM no detiene su facturación: una VM se factura desde que se crea hasta que se borra ([Máquinas virtuales](/docs/api/vms#lifecycle)). Encuentra las detenidas:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

Durante un tiempo, una VM detenida es una candidata razonable a rollback, como en un [despliegue blue/green](/docs/guides/blue-green#stop-blue). Cuando deje de serlo, bórrala:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Borrar una VM borra el volumen de arranque creado a partir de su imagen, y eso no se puede deshacer, así que antes copia lo que todavía necesites. Los volúmenes que conectaste más tarde se quedan, y el paso 3 los encuentra.

## 2 · IPs flotantes sin nada detrás {#unattached-ips}

Una IP flotante se factura desde que se crea hasta que se borra, esté asociada o no ([IPs flotantes](/docs/api/floating-ips#billing)). Encuentra las que no están asociadas:

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Borra las que no necesites, indicando sus ids en `ids`:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

Si algo tiene una dirección en una lista de permitidos en otro sitio, cambia eso primero: una vez que has borrado una dirección, puede que no la recuperes.

## 3 · Volúmenes que ninguna VM está usando {#volumes}

Un volumen se factura igual esté conectado o no ([Almacenamiento en bloques](/docs/api/block-storage#lifecycle)). Es fácil olvidarse de los volúmenes que sobreviven a su VM. Encuéntralos:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

Un volumen borrado no se puede recuperar, así que [haz antes un backup](/docs/api/backups#create) si es posible que quieras los datos. Después, bórralo:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · VMs sobredimensionadas {#over-provisioned}

El precio de una VM depende de su `architecture`, su `vm_class`, su `cpu` y su `ram`. Si la CPU y la memoria de una VM se mantienen bajas todo el tiempo, puede funcionar con una configuración más pequeña. Mide antes de decidir: [Monitoriza una flota de VMs](/docs/guides/monitoring-vms) configura las métricas.

Redimensiona con un `spec` nuevo; [Inicio rápido](/docs/quickstart#region) muestra de dónde salen `$ARCHITECTURE` y `$VM_CLASS`. La VM se reinicia con la configuración nueva y espera en `VERIFY_RESIZE`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Comprueba la VM con carga real y, después, conserva la configuración nueva o vuelve atrás con `revert_resize`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

En [Tamaños de VM](/docs/api/vm-sizes#resizing) están los detalles.

## 5 · Puertos públicos y ancho de banda {#bandwidth}

Un puerto en la red externa se factura hasta que lo borras, y su ancho de banda se factura con él, igual que el ancho de banda del gateway externo de un router ([Puertos de red](/docs/api/network-ports), [Routers](/docs/api/routers)). Una VM a la que no hace falta llegar desde internet puede estar en una red privada en su lugar ([Configuración de red del proyecto](/docs/guides/networking-setup)).

Lista los puertos de la red externa; `GET /api/v1/floating_ip/artifacts` lista las redes externas:

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

Un puerto con `device_id` vacío no está conectado a nada. Bórralo con `DELETE /api/v1/portal/port/{port_id}`.

Si necesitas el puerto, pero no todo su ancho de banda, redúcelo con `POST /api/v1/bandwidth/resize`, que cambia el límite de un puerto, una IP flotante o el gateway de un router, y con él su facturación. `bandwidth_mbps` debe ser un múltiplo de 10:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Imágenes personalizadas {#images}

Una imagen personalizada se factura por GB, redondeando hacia arriba al GB entero, como un producto propio ([Imágenes de VM](/docs/api/vm-images)). Lista tus imágenes privadas y, después, borra aquellas desde las que ya no arranca nada con `DELETE /api/v1/image/`:

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## La factura en sí {#invoice}

`GET /api/v1/billing/public/balances` muestra los cargos pendientes, el crédito promocional y el saldo prepago de tu workspace, y `GET /api/v1/billing/public/accrued_charges`, el total cargado hasta ahora que aún no se ha liquidado. Estas llamadas necesitan una sesión iniciada, no una clave de API, y las facturas en sí no están disponibles a través de la API ([Facturación](/docs/api/invoices)).

## Próximos pasos {#next-steps}

- [Datos de precios](/docs/api/pricing-data) — cuánto cuesta cada uno de estos recursos.
- [Facturación](/docs/api/invoices) — tus saldos y los cargos aún sin liquidar.
- [Tamaños de VM](/docs/api/vm-sizes) — las configuraciones y el redimensionado al completo.
- [Backups](/docs/api/backups) — copia un volumen antes de borrarlo, y cuánto tiempo conservan las copias las programaciones.
- [Cuotas](/docs/api/quotas) — los límites de recursos por proyecto, que son independientes de la facturación.
