# Platform UI Ecosystems - Research List

> Working document for tracking platforms that could have Fenestra specifications.
> Use this to spawn subagents for building individual platform specs.

**Total Platforms Identified**: 100+

---

## Priority Tiers

### Tier 1: High Priority (Build specs first)
Popular platforms with well-documented extension ecosystems.

| Platform | Category | Extension Type | Dev Docs | Status |
|----------|----------|----------------|----------|--------|
| HubSpot | CRM | Coded Components | [Link](https://developers.hubspot.com/docs/platform/ui-extensions-overview) | ✅ Example exists |
| Slack | Collaboration | JSON Response | [Link](https://docs.slack.dev/block-kit/) | ⏳ Pending |
| Salesforce | CRM | Coded Components | [Link](https://developer.salesforce.com) | ⏳ Pending |
| Figma | Design | Iframe | [Link](https://developers.figma.com/docs/plugins/) | ⏳ Pending |
| Canva | Design | Coded Components | [Link](https://www.canva.dev/docs/apps/app-ui-kit/) | ⏳ Pending |
| Stripe | Payments | Embedded SDK | [Link](https://docs.stripe.com) | ⏳ Pending |
| Shopify | E-commerce | Coded Components | [Link](https://shopify.dev) | ⏳ Pending |
| VS Code | Dev Tools | Coded Components | [Link](https://code.visualstudio.com/api) | ⏳ Pending |
| Zendesk | Support | Iframe + Coded | [Link](https://developer.zendesk.com) | ⏳ Pending |
| Microsoft Teams | Collaboration | JSON (Adaptive Cards) | [Link](https://docs.microsoft.com/en-us/microsoftteams/platform/) | ⏳ Pending |

### Tier 2: Medium Priority
Well-established platforms with good documentation.

| Platform | Category | Extension Type | Dev Docs | Status |
|----------|----------|----------------|----------|--------|
| Miro | Design | Iframe + SDK | [Link](https://developers.miro.com) | ✅ Example exists |
| Front | Support | Iframe | [Link](https://dev.frontapp.com) | ⏳ Pending |
| Asana | Productivity | JSON + Iframe | [Link](https://developers.asana.com) | ⏳ Pending |
| Monday.com | Productivity | Coded Components | [Link](https://developer.monday.com) | ⏳ Pending |
| Notion | Productivity | Iframe | [Link](https://developers.notion.com) | ⏳ Pending |
| Airtable | Productivity | Coded + JSON | [Link](https://airtable.com/developers) | ⏳ Pending |
| Intercom | Support | JSON + Iframe | [Link](https://developers.intercom.com) | ⏳ Pending |
| Freshdesk | Support | Iframe | [Link](https://developers.freshdesk.com) | ⏳ Pending |
| PayPal | Payments | Embedded SDK | [Link](https://developer.paypal.com) | ⏳ Pending |
| Plaid | Payments | Embedded SDK | [Link](https://plaid.com/docs/link/web/) | ⏳ Pending |

### Tier 3: Lower Priority (Future)
Smaller or more specialized platforms.

---

## Complete Platform List by Category

### 1. CRM Platforms

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Salesforce | Coded (LWC) + Iframe | [Link](https://developer.salesforce.com) | [AppExchange](https://appexchange.salesforce.com) | LWC, Canvas SDK |
| HubSpot | Coded (React) + JSON | [Link](https://developers.hubspot.com) | [Marketplace](https://ecosystem.hubspotpartnerprogram.com) | @hubspot/ui-extensions |
| Pipedrive | JSON + Iframe | [Link](https://developers.pipedrive.com) | [Marketplace](https://marketplace.pipedrive.com) | pipedrive-client |
| Zoho CRM | Coded + Iframe | [Link](https://www.zoho.com/crm/developer) | [Marketplace](https://marketplace.zoho.com) | Zoho Creator SDK |
| Microsoft Dynamics 365 | Coded (PCF) | [Link](https://docs.microsoft.com/dynamics365/) | [AppSource](https://appsource.microsoft.com) | PowerApps SDK |
| Freshsales | JSON + Iframe | [Link](https://developers.freshworks.com) | [Marketplace](https://marketplace.freshworks.com) | freshworks-sdk |
| Copper | JSON + Iframe | [Link](https://developer.copper.com) | [Integrations](https://www.copper.com/integrations) | Copper API |
| Close | Iframe | [Link](https://developer.close.com) | [Marketplace](https://resources.close.io/marketplace) | Close API |
| Insightly | JSON + Iframe | [Link](https://api.insightly.com) | [Marketplace](https://marketplace.insightly.com) | Insightly API |

### 2. Productivity & Collaboration

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Slack | JSON (Block Kit) | [Link](https://docs.slack.dev/block-kit/) | [App Directory](https://api.slack.com/apps) | @slack/bolt |
| Microsoft Teams | JSON (Adaptive Cards) | [Link](https://docs.microsoft.com/microsoftteams/platform/) | [App Store](https://appsource.microsoft.com) | @microsoft/adaptivecards |
| Notion | Iframe + Database | [Link](https://developers.notion.com) | [Integrations](https://www.notion.so/integrations) | @notionhq/client |
| Coda | Coded (Packs) | [Link](https://coda.io/developers) | [Packs](https://coda.io/packs) | Coda SDK |
| Airtable | Coded + JSON | [Link](https://airtable.com/developers) | [Marketplace](https://airtable.com/marketplace) | Airtable.js |
| Monday.com | Coded (React) | [Link](https://developer.monday.com) | [Marketplace](https://monday.com/marketplace) | monday-sdk-js |
| Asana | JSON + Iframe | [Link](https://developers.asana.com) | [App Directory](https://asana.com/apps) | Asana API |
| ClickUp | JSON + Iframe | [Link](https://docs.clickup.com) | [Marketplace](https://clickup.com/marketplace) | ClickUp API |
| Linear | Iframe + GraphQL | [Link](https://developers.linear.app) | [Integrations](https://linear.app/integrations) | Linear GraphQL |
| Trello | Iframe (Power-Ups) | [Link](https://developers.trello.com) | [Marketplace](https://trello.com/app-marketplace) | Trello.js |
| Jira | Iframe + Coded | [Link](https://developer.atlassian.com/cloud/jira) | [Marketplace](https://marketplace.atlassian.com) | Jira REST API |

### 3. Design & Creative Tools

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Figma | Iframe (Plugins) | [Link](https://developers.figma.com/docs/plugins/) | [Community](https://www.figma.com/community/plugins) | @figma/plugin-typings |
| Canva | Coded (React 19) | [Link](https://www.canva.dev/docs/apps/app-ui-kit/) | [App Store](https://www.canva.com/developers/apps/) | @canva/app-ui-kit |
| Miro | Iframe + Web SDK | [Link](https://developers.miro.com) | [Marketplace](https://miro.com/marketplace) | miro-js-sdk |
| Adobe Express | Iframe | [Link](https://developer.adobe.com/express/add-ons/docs/guides/) | [Add-ons](https://exchange.adobe.com) | Adobe UXP |
| Sketch | Iframe (Plugins) | [Link](https://developer.sketch.com) | [Plugins](https://www.sketch.com/extensions/plugins/) | Sketch Plugin API |
| Framer | Iframe + Coded | [Link](https://framer.com/developers) | [Marketplace](https://www.framer.com/marketplace) | Framer API |

### 4. Customer Support

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Zendesk | Iframe + Coded | [Link](https://developer.zendesk.com) | [Marketplace](https://www.zendesk.com/marketplace/) | ZAFClient |
| Freshdesk | Iframe | [Link](https://developers.freshdesk.com) | [Marketplace](https://marketplace.freshworks.com) | Freshdesk App SDK |
| Intercom | JSON + Iframe | [Link](https://developers.intercom.com) | [App Store](https://www.intercom.com/help/en/app-store) | @intercom/messenger-js-sdk |
| Front | Iframe | [Link](https://dev.frontapp.com) | [Integrations](https://frontapp.com/integrations) | @frontapp/plugin-sdk |
| Gorgias | JSON + Iframe | [Link](https://developers.gorgias.com) | [Marketplace](https://www.gorgias.com/integrations) | Gorgias SDK |
| Help Scout | Iframe | [Link](https://developer.helpscout.com) | [Integrations](https://www.helpscout.com/integrations/) | Help Scout API |
| Crisp | Iframe | [Link](https://docs.crisp.chat/api/) | [App Store](https://crisp.chat/en/integrations/) | Crisp API |
| Drift | Iframe | [Link](https://developer.drift.com) | [Marketplace](https://www.drift.com/integrations) | Drift Embed SDK |
| LiveChat | Iframe | [Link](https://developers.livechat.com) | [Integrations](https://www.livechat.com/integrations/) | LiveChat API |

### 5. E-commerce

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Shopify | Coded (Web Components) | [Link](https://shopify.dev) | [App Store](https://apps.shopify.com) | Shopify App Bridge |
| BigCommerce | Iframe + Coded | [Link](https://developer.bigcommerce.com) | [Marketplace](https://www.bigcommerce.com/apps/) | BigCommerce API |
| WooCommerce | Coded (PHP) | [Link](https://woocommerce.com/developer/) | [Marketplace](https://woocommerce.com/products/) | WooCommerce REST API |
| Magento | Coded (PHP/XML) | [Link](https://developer.adobe.com/commerce) | [Marketplace](https://marketplace.magento.com) | Magento Extension Framework |
| Wix | Iframe + Coded | [Link](https://dev.wix.com) | [App Market](https://www.wix.com/app-market) | Wix APIs |
| PrestaShop | Coded (PHP) | [Link](https://devdocs.prestashop.com) | [Marketplace](https://addons.prestashop.com) | PrestaShop Module API |

### 6. Developer Tools

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| GitHub | Iframe (Apps) | [Link](https://docs.github.com/developers) | [Marketplace](https://github.com/marketplace) | GitHub REST/GraphQL, Probot |
| GitLab | Iframe + Coded | [Link](https://docs.gitlab.com/ee/api/) | [Integrations](https://about.gitlab.com/integrations/) | GitLab API |
| VS Code | Coded (TypeScript) | [Link](https://code.visualstudio.com/api) | [Marketplace](https://marketplace.visualstudio.com/) | VS Code Extension API |
| JetBrains IDEs | Coded (Kotlin/Java) | [Link](https://plugins.jetbrains.com/docs) | [Marketplace](https://plugins.jetbrains.com) | IntelliJ Plugin SDK |
| Raycast | Coded (React/TS) | [Link](https://developers.raycast.com) | [Store](https://www.raycast.com/store) | Raycast API |

### 7. Marketing & Analytics

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Mixpanel | Iframe + JSON | [Link](https://developer.mixpanel.com) | [Integrations](https://mixpanel.com/integrations/) | Mixpanel SDK |
| Amplitude | Iframe + JSON | [Link](https://developers.amplitude.com) | [Integrations](https://amplitude.com/integrations) | Amplitude SDK |
| Segment | JSON | [Link](https://segment.com/docs/connections/) | [Catalog](https://segment.com/catalog/) | Segment API |
| Mailchimp | JSON + Iframe | [Link](https://mailchimp.com/developer/) | [Integrations](https://mailchimp.com/integrations/) | Mailchimp API |
| Marketo | Iframe + JSON | [Link](https://developers.marketo.com) | [Partners](https://business.adobe.com/products/marketo/partners.html) | Marketo REST API |
| Klaviyo | Embedded SDK + JSON | [Link](https://developers.klaviyo.com) | [Integrations](https://www.klaviyo.com/integrations) | klaviyo-api, Klaviyo.js |
| Braze | Embedded SDK + JSON | [Link](https://www.braze.com/docs/developer_guide) | [Partners](https://www.braze.com/partners) | @braze/web-sdk, Braze Swift SDK |

### 8. Finance & Payments

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Stripe | Embedded SDK | [Link](https://docs.stripe.com) | Limited | @stripe/stripe-js |
| PayPal | Embedded SDK | [Link](https://developer.paypal.com) | [Integrations](https://www.paypal.com/integrations) | PayPal JS SDK |
| Plaid | Embedded SDK | [Link](https://plaid.com/docs/link/web/) | [Partners](https://plaid.com/solutions/partnerships/) | react-plaid-link |
| Square | Embedded SDK | [Link](https://developer.squareup.com) | [Marketplace](https://squareup.com/appmarketplace) | Square Web Payments SDK |
| QuickBooks | Iframe + JSON | [Link](https://developer.intuit.com) | [App Center](https://appcenter.intuit.com) | QuickBooks REST API |
| Xero | Iframe + JSON | [Link](https://developer.xero.com) | [App Store](https://www.xero.com/appstore/) | Xero API |

### 9. HR & Recruiting

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Workday | Iframe + Coded | [Link](https://community.workday.com) | [Marketplace](https://www.workday.com/marketplace.html) | Workday HCM API |
| BambooHR | Iframe + JSON | [Link](https://developers.bamboohr.com) | [Integrations](https://www.bamboohr.com/integrations) | BambooHR REST API |
| Greenhouse | Iframe + JSON | [Link](https://developers.greenhouse.io) | [Integrations](https://www.greenhouse.io/integrations) | Greenhouse Harvest API |
| Lever | Iframe + JSON | [Link](https://hire.lever.co/developers) | [Integrations](https://www.lever.co/integrations) | Lever API |
| Gusto | Iframe + JSON | [Link](https://gusto.com/api) | [App Directory](https://gusto.com/integrations) | Gusto API |
| Rippling | Iframe + Coded | [Link](https://developer.rippling.com) | [Extensions](https://www.rippling.com/integrations) | Rippling API |

### 10. Workflow & Automation

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Zapier | JSON + Coded | [Link](https://zapier.com/developer) | [App Store](https://zapier.com/apps) | @zapier/platform-sdk |
| Make.com | JSON (RPC) | [Link](https://developers.make.com) | [Integrations](https://www.make.com/integrations) | Make API |
| Power Automate | JSON (OpenAPI + Cards) | [Link](https://learn.microsoft.com/power-automate) | [AppSource](https://appsource.microsoft.com) | Adaptive Cards SDK |
| n8n | JSON + Iframe | [Link](https://docs.n8n.io) | [Integrations](https://n8n.io/integrations) | n8n SDK |
| Tray.io | JSON + Iframe | [Link](https://tray.io/documentation) | [Marketplace](https://tray.io/integrations) | Tray iPaaS API |
| Workato | JSON + Iframe | [Link](https://docs.workato.com) | [Connectors](https://docs.workato.com/connectors.html) | Workato SDK |

### 11. ERP & Business Systems

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| NetSuite | Coded (SuiteScript) + SPAs | [Link](https://docs.oracle.com/netsuite) | [Marketplace](https://www.netsuite.com/portal/marketplace/apps) | SuiteScript 2.x, @netsuite/uif |
| SAP S/4HANA | Coded (SAPUI5) | [Link](https://developers.sap.com) | [SAP Store](https://store.sap.com) | SAPUI5 SDK |
| Oracle ERP | Iframe + APEX | [Link](https://docs.oracle.com) | [Marketplace](https://cloudmarketplace.oracle.com) | Oracle APEX |
| Odoo | Coded (Python/XML) | [Link](https://www.odoo.com/documentation) | [App Store](https://apps.odoo.com) | Odoo Framework |

### 12. Identity & Auth

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Auth0 | Embedded SDK | [Link](https://auth0.com/docs) | [Marketplace](https://marketplace.auth0.com) | auth0-js, @auth0/auth0-react |
| Okta | Embedded SDK | [Link](https://developer.okta.com) | [Integrations](https://www.okta.com/integrations/) | okta-auth-js |

### 13. Scheduling & Calendar

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Calendly | Embedded Widget | [Link](https://developer.calendly.com) | [Integrations](https://calendly.com/integrations) | Calendly API |
| Cal.com | Embedded + Open Source | [Link](https://cal.com/docs) | [Marketplace](https://cal.com/marketplace) | Cal.com API |

### 14. Forms & Surveys

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Typeform | Embedded SDK | [Link](https://www.typeform.com/developers/) | [Integrations](https://www.typeform.com/integrations/) | @typeform/embed |
| JotForm | Iframe | [Link](https://jotform.io/api/) | [Integrations](https://www.jotform.com/integrations) | JotForm API |
| Tally | Iframe | [Link](https://tally.so/help) | [Integrations](https://tally.so/integrations) | Tally API |

### 15. Video & Meetings

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Zoom | Iframe + SDK | [Link](https://developers.zoom.us) | [Marketplace](https://marketplace.zoom.us) | Zoom SDK |
| Loom | Embedded Widget | [Link](https://www.loom.com/developers) | Limited | Loom Embed SDK |
| Daily.co | Embedded SDK | [Link](https://docs.daily.co) | [Marketplace](https://www.daily.co/marketplace) | Daily.co SDK |

### 16. AI & ML Platforms

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| OpenAI | JSON + Plugins | [Link](https://platform.openai.com/docs) | [Plugin Store](https://openai.com/blog/plugins) | openai |
| Anthropic | JSON (MCP) | [Link](https://docs.anthropic.com) | MCP ecosystem | @anthropic-ai/sdk |
| Hugging Face | Iframe (Spaces) | [Link](https://huggingface.co/docs) | [Spaces](https://huggingface.co/spaces) | transformers |

### 17. Documentation & CMS

| Platform | Extension Type | Dev Docs | Marketplace | SDK |
|----------|----------------|----------|-------------|-----|
| Confluence | Iframe + Coded | [Link](https://developer.atlassian.com/cloud/confluence) | [Marketplace](https://marketplace.atlassian.com) | Confluence REST API |
| Contentful | Iframe + JSON | [Link](https://www.contentful.com/developers/) | [App Framework](https://www.contentful.com/developers/docs/concepts/apps/) | @contentful/app-sdk |
| WordPress | Coded (PHP) | [Link](https://developer.wordpress.org) | [Plugins](https://wordpress.org/plugins/) | WordPress Plugin API |

---

## Extension Type Distribution

| Type | Count | Examples |
|------|-------|----------|
| **JSON Response** | ~22 | Slack, Asana, Zapier, Make.com, Power Automate |
| **Coded Components** | ~28 | HubSpot, Canva, VS Code, Shopify, Monday.com |
| **Iframe** | ~31 | Front, Zendesk, Figma, Miro, Freshdesk |
| **Embedded SDK** | ~14 | Stripe, PayPal, Plaid, Auth0, Typeform, Klaviyo, Braze |
| **Agent UI** | ~8 | MCP Apps, Power Automate Copilot |

---

## Usage

To build a Fenestra spec for a platform:

```bash
# Spawn a subagent to research and build a spec
# Example prompt:
"Build a complete Fenestra specification for [Platform Name].
Use the developer docs at [URL].
Include all components, extension points, SDK bindings, and policies.
Output as examples/[platform].fenestra.yaml"
```

---

## See Also

- [ECOSYSTEM-MAPPING.md](./ECOSYSTEM-MAPPING.md) - Detailed research on mapped platforms
- [examples/](./examples/) - Existing Fenestra spec examples
- [fenestra-spec.yaml](./fenestra-spec.yaml) - The specification schema
