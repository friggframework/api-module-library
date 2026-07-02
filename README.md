# Frigg API Module Library

## Overview

Welcome to the Frigg API Module Library! This repository contains the API
modules that connect third-party services to the [Frigg
Framework](https://github.com/friggframework/frigg) — the reusable API-client
building blocks (auth, requests, entity/credential handling) that integrations
are composed from.

To browse the modules, see the
[v1-ready directory](https://github.com/friggframework/api-module-library/tree/main/packages/v1-ready).

## Using with Frigg 2.0

These modules work with **Frigg 2.0**. The 2.0 release is a framework-level
change — a DDD/hexagonal refactor with a Prisma-based, multi-database data layer
and a provider-agnostic infrastructure foundation — so the way you *run* a Frigg
app changed, while API modules remain the same authenticated API clients they
were.

* New to 2.0? Read
  [What's New in 2.0](https://docs.friggframework.org/getting-started/whats-new-in-2.0).
* Upgrading an app? See the
  [1.x → 2.0 migration guide](https://docs.friggframework.org/guides/migrating-to-2.0).
* Add a module to your app with the CLI: `frigg install <module>`.

> Frigg 2.0 apps run on Node >= 22 / npm >= 10.

## Directory Structure

### v1-ready API Modules

The [v1-ready modules](https://github.com/friggframework/api-module-library/tree/main/packages/v1-ready)
are refactored and optimized to align with Frigg's modern, simplified module
architecture and are compatible with current Frigg (v1 and 2.0). They are
designed to be intuitive, easy to integrate, and performant.

### Older API Modules

The [needs-updating directory](https://github.com/friggframework/api-module-library/tree/main/packages/needs-updating)
contains the original modules from the v0 Frigg repository. These are **not**
updated for the current module architecture. If your project is still on Frigg
v0, these modules should work.

## Documentation

Per-module documentation (configuration, getting started, supported APIs, and
available methods) lives in the main docs site under
[API Modules](https://docs.friggframework.org/api-modules/module-list/README).

---

Thank you for your interest in the Frigg project! We're excited to see how the
community will continue to grow and improve these API modules. If you have any
questions or need assistance, feel free to
[contact us](https://docs.friggframework.org/support/support).

**~ The Frigg Maintainers** (Should we start a band?)
