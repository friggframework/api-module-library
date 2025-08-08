Frigg API Module Library

Overview

Welcome to the Frigg API Module Library! This repository contains all the API modules ready to connect third-party services with Frigg.

To view our API Modules, please visit the [v1-ready directory](https://github.com/friggframework/api-module-library/tree/main/packages/v1-ready).

As part of our efforts to streamline development and prepare for future growth, we’ve made some significant changes to how our API Modules are organized and maintained.

## Directory Structure

### v1-ready API Modules
These [v1-ready API Modules](https://github.com/friggframework/api-module-library/tree/main/packages/v1-ready) are refactored and optimized to align with the new, simplified architecture of Frigg v1. They are designed to be more intuitive, easier to integrate, and provide better performance.

### Older API Modules

The [needs-updating directory](https://github.com/friggframework/api-module-library/tree/main/packages/needs-updating) contains our original API modules that were included in the v0 Frigg repository. These modules are not ready to work with Frigg v1. If your project is still using 
    Frigg v0, these modules should work.


Thank you for your interest in the Frigg project! We’re excited to see how the community will continue to grow and improve these API modules. If you have any questions or need assistance, feel free to [contact us](https://docs.friggframework.org/support/support).

**~ The Frigg Maintainers** (Should we start a band?)

## Fenestra UI Extension Specifications

This library now includes Fenestra specifications for platform UI extensibility.
Fenestra provides a universal standard for describing UI extensions across platforms.

### Documentation
- [Fenestra Platform Specification](docs/fenestra/fenestra-platform-spec-v1.0.md)
- [Implementation Guide](docs/fenestra/IMPLEMENTATION_GUIDE.md)

### Supported Platforms
Each API module includes Fenestra specifications in the `fenestra/` directory:
- HubSpot (CRM cards, workflow actions, UI extensions)
- Slack (bots, Block Kit, slash commands, workflows)
- Microsoft Teams (adaptive cards, tabs, message extensions)
- Salesforce (Lightning components, Visualforce, Canvas)
- And more...


### Recently Added Platforms
The following platforms have been added with comprehensive Fenestra specifications:

#### Communication & Collaboration
- **Microsoft Teams** (v1-ready) - Bots, adaptive cards, tabs, meeting apps
- **Slack** (needs-updating) - Block Kit, workflows, slash commands, home tabs

#### CRM & Sales  
- **HubSpot** (v1-ready) - CRM cards, workflows, UI extensions, marketplace
- **Salesforce** (v1-ready) - Lightning, Visualforce, Canvas, AppExchange
- **Pipedrive** (v1-ready) - Custom apps, automation, reporting extensions

#### Project Management
- **Asana** (v1-ready) - App components, custom fields, rules, forms
- **Monday.com** (v1-ready) - Board views, automation, dashboard widgets
- **Notion** (v1-ready) - Database integrations, block embeds, workspace extensions
- **Trello** (v1-ready) - Power-ups, board widgets, automation

#### Development & Design
- **GitHub** (v1-ready) - Apps, actions, webhooks, marketplace
- **Figma** (v1-ready) - Design plugins, widgets, automation
- **Airtable** (v1-ready) - Custom apps, automation scripts, interface designer

#### E-commerce & Business
- **Shopify** (v1-ready) - Apps, checkout extensions, theme extensions
- **Canva** (v1-ready) - Design apps, brand management, marketplace widgets

#### Enterprise Platforms
- **Google Workspace** (v1-ready) - Add-ons, Apps Script, card service
- **Zendesk** (needs-updating) - Support apps, automation triggers, marketplace

Each platform includes:
- Complete Fenestra platform specifications
- 6-8 different extension types
- Multiple communication channels and APIs
- Authentication methods and security
- Deployment models and marketplace information
- Development SDKs and tools
- Real-world examples and use cases
