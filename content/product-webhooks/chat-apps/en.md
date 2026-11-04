---
title: Slack, Teams and Discord
description: Send events to a Slack, Microsoft Teams or Discord channel, with a template that turns each event into a message the channel accepts.
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: guide
---

# Slack, Teams and Discord

Slack, Microsoft Teams and Discord each give a channel a webhook URL that posts whatever it receives — but only in their own message format, so they reject the event envelope we normally send. A [transformation](/docs/product-webhooks/transformations) bridges the gap. By the end of this guide you'll have:

- an endpoint aimed at your channel's webhook URL;
- that app's template turning each event into a message it accepts;
- a test event posted in the channel.

Total time: about 10 minutes.

## Prereqs {#prereqs}

- A Webhooks workspace, on any plan: the chat templates are pipelines, which every plan includes.
- The right to add a webhook to the channel: in Slack, to install an app in the workspace; in Teams, to create a workflow; in Discord, the **Manage Webhooks** permission.
- [Endpoint verification](/docs/product-webhooks/endpoint-verification#cannot-echo) off for the project the endpoint goes in. These channels take only their own messages, so they can never answer the verification challenge, and an endpoint that must pass it receives nothing. Paid plans can turn verification off; on a plan that requires it, these channels can't be used.

## 1 · Get the channel's webhook URL {#webhook-url}

### Slack {#slack}

Create a Slack app for your workspace and turn on **Incoming Webhooks** in its settings. Choose **Add New Webhook to Workspace**, pick the channel and authorize it. Copy the URL, which looks like `https://hooks.slack.com/services/T…/B…/…`. Slack's own steps are in [Sending messages using incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

In Teams, open **Workflows** and start from the template **Send webhook alerts to a channel**. Choose the team and the channel, save the workflow, and copy the webhook URL from its details. Microsoft's own steps are in [Create incoming webhooks with Workflows for Microsoft Teams](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

In Discord, open **Server Settings → Integrations → Webhooks** and create a webhook. Pick the channel it posts to, then **Copy Webhook URL**, which looks like `https://discord.com/api/webhooks/…/…`. Discord's own steps are in [Intro to Webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Treat the URL as a secret: these channels don't check our signature, so anyone who has it can post to the channel.

## 2 · Add the endpoint {#endpoint}

In the console, choose **New endpoint** on the **Endpoints** page, paste the URL, and subscribe it to the events the channel should see. Keep the list short: a channel is read by people, and every matching event becomes a message.

Through the API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Start from the template {#preset}

Open the endpoint's menu on the **Endpoints** page and choose **Transformation**. Choose **Pipeline**, then, under **Start from a template**, the one for your app — **Use Slack message**, **Use Microsoft Teams card** or **Use Discord message** — and **Save**. From now on, each delivery to this endpoint is sent as a message:

| Template | What the channel shows |
|---|---|
| Slack message | The event type as a header, its id and time, and its data in a code block. |
| Microsoft Teams card | An Adaptive Card with the event type, its id and time, and its data in monospace. |
| Discord message | An embed with the event type as its title, its data in a JSON code block, and its id and time beneath. It mentions no one. |

Each template cuts the data to fit the app's limits, and nothing in the event can format the message, mention anyone or end the code block early. Saving makes the pipeline your own: it doesn't change when the template does.

Through the API, `GET /v1/transformations/templates` returns each template with its `pipeline`: [create a transformation](/docs/product-webhooks/transformations#set-up) with that document, then set the endpoint's `transformation_id` to it.

An endpoint that already runs one of the old presets, which are scripts, keeps running it unchanged.

## 4 · Test it {#test}

Under **Test** on the same page, choose **Run test**. It runs the pipeline in the editor against a recent event from the endpoint's deliveries, or one you paste, and shows the message it would send. Nothing is sent.

Then send a real one: **Send test event** on the console's Overview, or publish an event the endpoint subscribes to:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

The message appears in the channel within a few seconds. The endpoint's **Send test ping** is no use here: it sends its fixed ping untransformed, and the channel turns it away.

## What you've done {#summary}

Every event the endpoint subscribes to now posts a message in your channel. Open a delivery on the **Deliveries** page to see the message that was sent; if the app answered with an error, it is there too, under the delivery's attempts.

## Making it your own {#customize}

The template's steps are now your pipeline's, so you can change them like any other. To keep the channel for the events people need, add a **Filter** step with **Send only matching events** and two conditions, `type` **is** `invoice.paid` and `data.amount` **is at least** `100000`, then move it to the top, so it tests the event before the message is built. As JSON:

```json
{ "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } } }
```

A delivery the filter drops is not sent and does not count as failed. To change what the message says, edit the **Reshape the body** step that builds it; the console shows it as JSON, so change it there and choose **Apply**. Its values read the event through [paths and filters](/docs/product-webhooks/transformations#values), such as `{{ data.amount | money(data.currency) }}`. Test before you save: a run that fails sends the delivery to the dead-letter queue, never the untransformed event.

## Next steps {#next-steps}

- [Transformations](/docs/product-webhooks/transformations#templates) — templates, pipeline steps, testing and what happens when a run fails.
- [Endpoint verification](/docs/product-webhooks/endpoint-verification#cannot-echo) — receivers that cannot answer the challenge.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — states, retries and sending again.
