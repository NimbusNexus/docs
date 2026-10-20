---
title: Addresses and the phrase
description: Why a disposable address refuses mail whose subject lacks its phrase, and how expiry, retention and deletion differ.
publishedAt: 2026-08-18
updatedAt: 2026-10-19
kind: concept
---

# Addresses and the phrase

A disposable address is public by construction: it is going into a signup form, a CI log, maybe a screenshot. Anyone who sees it can mail it. This page is about the two mechanisms that make that safe — the **phrase**, and the fact that addresses **die**.

## The phrase {#phrase}

A free inbox is always issued a short token alongside its address. On Starter, Pro and Custom it gets one only when you ask, with `"phrase": true` at allocation or in a later `PATCH`. An inbox with a phrase accepts a message only if the phrase appears in the **subject**; one without accepts any subject:

```text
Subject: nn-re89dr Your verification code   ← accepted
Subject: Your verification code             ← refused
```

The phrase is not a password and not a secret — it travels in plaintext in a subject line. What it is, is a *shared-secret-shaped nuisance*: it means a leaked address is not, on its own, a usable address.

That distinction is the product. Without it, a disposable address found in a public CI log could be used to register accounts on other services, receive their confirmation mails, and hand somebody an account you cannot see and did not create. The address would be a free anonymous identity generator. Requiring the phrase means whoever holds the address must also have been told the phrase by the same API call that issued it — which the person scraping your build output was not.

It also means **you control what the address will accept**. A system under test that you configure will put the phrase in its subject because you told it to. A drive-by will not.

Where to put it: anywhere in the subject. Matching is on the subject only — a phrase in the body does not count, because the body is the part an attacker can most easily stuff with anything.

## Refusal is loud {#refusal}

Mail that fails any acceptance rule is refused **during the SMTP conversation**, not accepted and hidden:

- the address is unknown, expired, deleted or disabled;
- the inbox has a phrase and the subject does not contain it;
- the workspace is over its monthly allowance;
- the message is larger than 5 MiB.

This matters more than it sounds. The alternative — accept, then quietly discard — produces an empty inbox that looks exactly like a sender that never sent. Refusing at the door means the sender gets a rejection it can log, and an empty inbox in your test means *nothing was sent*, which is a different bug from *something was sent and rejected*.

Refused mail is never stored and never counted against usage.

## Three ways an address ends {#lifecycle}

They are easy to confuse and behave differently.

| | What happens | Reversible |
| --- | --- | --- |
| **Expiry** | The address reaches `expires_at`, is retired, and its stored mail is deleted. | No |
| **Delete** | You end it early with `DELETE /v1/inboxes/{id}`. Retired immediately, same as expiry. | No |
| **Disable** | The address stops accepting mail and keeps what it already has. | Yes — enable it again |

A retired address is **never reissued**, to you or to anyone: every address that ever existed is recorded, and a new one is checked against that record before it is issued. That is a security property rather than an implementation detail — recycling a disposable address would eventually deliver a stranger's password reset into somebody else's test run. The supply does not run out: an address is 12 characters from a 32-character alphabet, about 1.15 × 10¹⁸ combinations.

Reach for **disable** when a test suite is spamming an address and you want it to stop for an hour. Reach for **delete** when you are finished and want the slot back — plans cap how many addresses you may hold at once. Older versions of these docs, and the API's audit log, call deleting *release*.

## Expiry is not retention {#expiry-vs-retention}

Two different clocks, and mixing them up is the usual source of "my message vanished":

- **Expiry** (`expires_at`) is how long the **address** lives.
- **Retention** is how long an accepted **message** stays readable, and it is set by your plan.

The shorter one wins. On a plan with 24-hour retention, a message received today is unreadable tomorrow even if the address itself lives for a week. When the address expires, everything in it goes at once regardless of retention.

Deletion is real. There is no archive and no undelete, so a test asserting on mail older than its retention window will fail in a way that reads like a delivery problem and is not.

## Addresses live on their own domain {#domain}

Allocated addresses are on a dedicated inbox domain, not on `{{ROOT_DOMAIN}}` and not on yours. That is deliberate: a domain accumulating disposable-address traffic accumulates the reputation that goes with it, and keeping that away from the domain your real mail comes from is worth an extra DNS record.

The practical consequence is that you should never assume the address's domain from the product's. Read `address` from the allocation response and use it verbatim.
