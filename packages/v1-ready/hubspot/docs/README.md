# HubSpot

This module exports an OAuth-aware `Api`, a Frigg authorization `Definition`,
`Config`, and `extensions.webhooks`. It wraps selected CRM, list, association,
custom-object, property, owner, timeline, CMS and template operations. It is not
the complete HubSpot API or a generated replacement for the provider's SDK.

```bash
npm install {{PACKAGE}}@{{VERSION}}
```

This exact release declares Frigg compatibility `{{FRIGG_RANGE}}`. Its Node
engines range is `{{NODE_RANGE}}`; unknown means the package declares no range.
Declared compatibility is separate from tested compatibility. The documentation
pilot checks wrapper calls with fixtures; it does not establish a live-account
test or a matrix of Frigg versions. Use the runtime requirements of your installed
Frigg release.

- [First successful call](getting-started.md)
- [OAuth setup and credential lifecycle](authentication.md)
- [Public methods](reference.md)
- [Pagination, errors, webhooks and limitations](operations.md)
- [Release changes and support](changes.md)

The package uses the MIT license and is maintained by the Frigg Framework
maintainers. HubSpot product entitlements and scopes determine which operations
an account can use; exported method names do not grant those permissions.
