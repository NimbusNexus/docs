---
title: "Розміри VM"
description: "Обчислювальні flavor-и — vCPU, RAM і swap — і як VM отримує один із них."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Розміри VM

Розмір VM — це flavor: кількість vCPU (`vcpus`), RAM у MB (`ram`) і swap у MB (`swap`). Під час створення VM flavor не вибирають: ви задаєте `spec.cpu` і `spec.ram`, а API використовує flavor саме з такими значеннями й створює його, якщо такого немає. Завантажувальний диск не входить до flavor-а; це окремий том.

## Архітектура і клас VM {#families}

Крім `cpu` і `ram`, `spec` VM указує `architecture` і `vm_class`. Разом вони визначають продукт, за яким тарифікується VM. Доступні в регіоні вашої сесії варіанти наведено у `vm_options` з `GET /api/v1/instance/artifacts`.

## Схема іменування {#naming}

Конфігурацію flavor-а визначайте за `vcpus`, `ram` і `swap`, а не за його назвою. Flavor, який API створює для VM, отримує назву за своїм `id` (UUID), як і flavor, створений через `POST /api/v1/flavor/` без `name`. `GET /api/v1/flavor/` фільтрує за конфігурацією через `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` і `max_swap`.

Ціни залежать від `architecture`, `vm_class`, `cpu` і `ram`; див. [Дані про ціни](/docs/api/pricing-data).

## Зміна розміру {#resizing}

VM може переходити між розмірами без повторного розгортання. Надішліть `POST /api/v1/instance/{instance_id}/resize` з новим `spec` (`architecture`, `vm_class`, `cpu`, `ram`). VM перезапускається на новому flavor-і й чекає в стані `VERIFY_RESIZE`: `POST /api/v1/instance/{instance_id}/confirm_resize` залишає новий розмір, а `POST /api/v1/instance/{instance_id}/revert_resize` повертає старий. Обидва відповідають `400`, якщо VM не в стані `VERIFY_RESIZE`.

## Що далі {#next-steps}

- [Віртуальні машини](/docs/api/vms) — ендпоінти, які власне розгортають VM одного з цих розмірів.
- [Образи VM](/docs/api/vm-images) — шаблони ОС, з якими завантажується VM.
- [SSH-ключі](/docs/api/ssh-keys) — публічні ключі, що додаються у VM під час завантаження.
