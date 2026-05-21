---
title: Address groups
description: Named sets of CIDRs reusable across security group rules.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: address-groups
---

# Address groups

An address group is a named, mutable set of CIDR blocks you can reference from [security group](/docs/api/security-groups) rules. Instead of pasting the same allowlist into ten security groups, you create one address group (`office-cidrs`) and reference it from each rule. Add or remove a CIDR from the group; every referencing rule updates immediately.

The canonical use case: corporate VPN CIDRs that change over time. Maintaining the list inline across every security group means going hunting when a CIDR moves; maintaining it in one address group means updating in one place.

## What's next {#next-steps}

- [Security groups](/docs/api/security-groups) — where address groups get referenced.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — the network layer address groups apply within.
