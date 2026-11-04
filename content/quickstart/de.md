---
title: "Schnellstart"
description: "API-Key generieren, Ihre Optionen abrufen und Ihre erste VM erstellen."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: quickstart
---

# Schnellstart

Diese Anleitung bringt Sie in wenigen API-Aufrufen von einem angemeldeten Dashboard-Konto zu einer laufenden virtuellen Maschine. Alles, was Sie hier tun, lässt sich rückgängig machen: Löschen Sie die VM, wenn Sie fertig sind. Eine VM wird vom Erstellen bis zum Löschen abgerechnet, lassen Sie sie also nicht versehentlich weiterlaufen; die Preise finden Sie unter [Preisdaten](/docs/api/pricing-data).

## Bevor Sie beginnen {#prereqs}

Sie brauchen drei Dinge:

- Ein NimbusNexus-Konto. Registrieren Sie sich unter [{{ROOT_DOMAIN}}]({{BASE_URL}}/register).
- Das Kommandozeilentool `curl` oder einen beliebigen anderen HTTP-Client, dazu `jq`, um die Antworten zu lesen. Die Beispiele auf dieser Seite verwenden `curl`; dieselben Aufrufe funktionieren in jeder Sprache.
- Etwa fünf Minuten.

SSH müssen Sie noch nicht eingerichtet haben: Diese VM bootet ohne Key. Um sich später an einer VM anzumelden, registrieren Sie zuerst einen Key ([SSH-Keys](/docs/api/ssh-keys)) und geben ihn beim Erstellen der VM in `sshs` an.

## 1 · API-Key generieren {#api-key}

Melden Sie sich im Dashboard an und gehen Sie zu **Sicherheit → API-Token → Token erstellen**. Geben Sie dem Token einen Namen, den Sie später wiedererkennen (z. B. `quickstart`), und wählen Sie den Scope **Admin**, der einen uneingeschränkten Key erzeugt. Die anderen beiden Scopes erzeugen einen Key ohne Zugriffsregeln, und dieser Key kann nur seine eigene Sitzung lesen. Kopieren Sie den Wert mit der Bezeichnung **API-Schlüssel**, nicht **Secret**, an einen sicheren Ort — Sie sehen ihn nur einmal.

Exportieren Sie ihn als Umgebungsvariable, damit die Beispiele unten darauf zugreifen können:

```bash
export NIMBUS_KEY="<your-api-key>"
```

Senden Sie ihn bei jedem Aufruf im Header `X-API-Key`. API-Keys gelten für ein einzelnes Projekt. Das Standardprojekt, das mit Ihrem Konto angelegt wird, reicht vorerst. [Authentifizierung](/docs/authentication#scopes) behandelt Keys, die auf die Aufrufe begrenzt sind, die sie brauchen.

## 2 · Ihre Optionen abrufen {#region}

NimbusNexus bedient heute eine Region, in Frankfurt, Deutschland, daher gibt es keine Region zu wählen; Details finden Sie unter [Regionen](/docs/api/regions). Fragen Sie die API, was Sie dort erstellen können:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data | {
      images: [.images.data[] | { id, name }],
      vm_options: [.vm_options.data[] | { architecture: .label, vm_classes: [.children[]?.label] }],
      networks: [.networks.data[] | { id, name, external, subnets: [.subnets[].cidr] }],
      security_groups: [.security_groups.data[] | { id, name }]
    }'
```

Den Volume-Typ der Boot-Disk liefert ein zweiter Aufruf:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '[.data.volume_options.data[].label]'
```

Wählen Sie jeweils einen Wert aus und exportieren Sie die Werte. Images, Netzwerke und Sicherheitsgruppen geben Sie über ihre `id` an; Architekturen, VM-Klassen und Volume-Typen über ihre Bezeichnung. Wählen Sie ein Netzwerk mit `external: false`, das ein Subnetz hat: Für den Beitritt zu einem externen Netzwerk braucht es außerdem `bandwidth_mbps` und `subscription.bandwidth`; ohne sie antwortet der Aufruf mit `400`.

```bash
export IMAGE_ID="<image-id>"
export ARCHITECTURE="<architecture>"
export VM_CLASS="<vm-class>"
export VOLUME_TYPE="<volume-type>"
export NETWORK_ID="<network-id>"
export SECURITY_GROUP_ID="<security-group-id>"
```

## 3 · Erste VM erstellen {#first-vm}

Die Ausstattung einer VM besteht aus ihrer Anzahl an `cpu` und ihrem `ram` in MB. Ihre Boot-Disk ist `volume_size` GB groß. So starten Sie eine mit einer vCPU, 2 GB RAM und einer 25-GB-Disk:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"quickstart\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"]
  }"
```

Auf eine Ausstattung, die für diese Architektur und Klasse nicht angeboten wird, antwortet die API mit `400`; [Preisdaten](/docs/api/pricing-data) listet die Ausstattungen auf. Andernfalls stellt der Aufruf die Arbeit in die Warteschlange und antwortet ohne ID:

```json
{
  "success": true
}
```

Suchen Sie die neue VM anhand ihres Namens und lesen Sie ihren `status`:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.name == "quickstart") | { id, status, nics, fault }'
```

`status` ist zuerst `BUILD`, dann `ACTIVE`, mit den Adressen der VM in `nics`:

```json
{
  "id": "3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60",
  "status": "ACTIVE",
  "nics": {
    "my-network": [
      { "addr": "10.0.0.12", "version": 4, "OS-EXT-IPS:type": "fixed" }
    ]
  },
  "fault": null
}
```

Fragen Sie die VM in Abständen ab, bis `status` `ACTIVE` ist. Ist er `ERROR`, sagt `fault`, was schiefgelaufen ist. Speichern Sie die ID:

```bash
export VM_ID="<vm-id>"
```

## Zusammenfassung {#summary}

Sie haben einen API-Key generiert, Ihre Optionen abgerufen und eine echte virtuelle Maschine bereitgestellt. Viele Ressourcen funktionieren genauso: Ein Aufruf von `artifacts` listet Ihre Optionen auf, `POST` erstellt und `GET` liest. Das Löschen unterscheidet sich je nach Ressource, prüfen Sie also deren Referenzseite. Der API-Key und der Header sind überall auf `{{API_HOST}}` dieselben.

## Nächste Schritte {#next-steps}

- Durchsuchen Sie die **API-Referenz**, um jeden Endpoint mit Parametern, Request-/Response-Schemas und Fehlercodes zu sehen.
- Hängen Sie eine [Floating-IP](/docs/api/floating-ips) an, um die VM aus dem Internet zu erreichen.
- Lesen Sie mehr zur **Authentifizierung**, um zu verstehen, wie API-Keys mit der Projektbindung, Rollen und Zugriffsregeln zusammenspielen.
- Lesen Sie die **Konventionen**, um die Muster kennenzulernen, denen die API folgt — Paginierung, Fehlerformate, Arbeit, die erst nach der Antwort abgeschlossen ist.
- Probieren Sie den **interaktiven API-Explorer** unter [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) aus — eine Swagger UI, die an die Live-API angebunden ist; „Try it out“ sendet echte Aufrufe an Ihr Konto.

Wenn Sie fertig sind, löschen Sie die VM, damit keine Kosten mehr anfallen. Ihr Boot-Volume wird mit ihr gelöscht:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```
