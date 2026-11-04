# Changes and support

This snapshot documents `{{PACKAGE}}@{{VERSION}}`. Its release record contains
the immutable source input commit, the exact package metadata after release
versioning, generator identity, bundle digest, and verified npm integrity.
The catalog links to the package changelog at that source input commit.

Before upgrading, compare the target version's public-method reference and
limitations and read its package changelog. A provider API change and a wrapper
package release are separate version dimensions. The OAuth implementation in
this source uses date-based token endpoints while many CRM methods retain v3
paths and association methods retain v4 paths.

This first docs pilot does not backfill earlier package versions or claim that
current code describes those historical releases. It introduces no authentication
or runtime API migration. Future breaking wrapper changes must carry migration
instructions alongside their release notes.

The package is MIT licensed. Report wrapper and documentation issues to the
[module library issue tracker](https://github.com/friggframework/api-module-library/issues)
with exact package/Frigg versions, method and redacted reproduction. Send HubSpot
account, app-entitlement or service incidents through the provider's support
channel. Never include client secrets, tokens, customer records or signed webhook
bodies in a public issue.
