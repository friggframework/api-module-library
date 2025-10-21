# v1.1.0 (Mon Oct 21 2024)

:rocket: **API v2 Migration & Persons API Support** :rocket:

This release migrates core endpoints to Pipedrive API v2 and adds comprehensive Persons API support with cursor-based pagination.

#### 💥 Breaking Changes

- **API v2 Migration**: Activities and Deals endpoints migrated from v1 to v2
  - Activities: `/v1/activities` → `/v2/activities`
  - Deals: `/v1/deals` → `/v2/deals`
  - V2 uses RFC 3339 timestamps and removes related objects from responses
  - V1 endpoints deprecated by Pipedrive, will be removed end of 2025

#### 🚀 Enhancement

- **Persons API**: Added comprehensive support for Persons endpoints
  - `listPersons(params)` - List persons with filtering and pagination
  - `getPerson(personId, params)` - Fetch single person by ID
  - Supports v2 query parameters: `filter_id`, `owner_id`, `org_id`, `updated_since`, `sort_by`, `include_fields`, `custom_fields`
- **Cursor-Based Pagination**: Full v2 pagination support across all list endpoints
  - `cursor` parameter for pagination navigation
  - `limit` parameter (default 100, max 500)
  - Response includes `additional_data.next_cursor` for next page
- **Enhanced Parameters**: All list methods now accept comprehensive query parameters
  - `listActivities()`: Added `cursor`, `limit`, `user_id`, `filter_id`, `type`, `start_date`, `end_date`, `done`
  - `listDeals()`: Added `cursor`, `limit`, `filter_id`, `stage_id`, `status`, `user_id`, `org_id`, `person_id`
- **Improved Documentation**: Added comprehensive JSDoc comments for all person and list methods

#### 🏗️ Refactoring

- **Updated**: `api.js` - Migrated endpoint URLs to v2, added person methods, enhanced pagination support

#### 📦 Migration Guide

If you're upgrading from v1.0.0 to v1.1.0:

1. **Activities & Deals**: Endpoints now use v2 API
   - Response format changed: Related objects removed, timestamps now in RFC 3339 format
   - Test your integration to ensure v2 response format compatibility
2. **Pagination**: Use `cursor` and `limit` instead of v1's `start` and `limit`
   - Check `additional_data.next_cursor` in response for next page (null when no more pages)
3. **Persons API**: New methods available for person data access
   - Use `listPersons(params)` for paginated person lists
   - Use `getPerson(personId, params)` for individual person details

#### 🎯 API Coverage

- ✅ Activities: list, create, update, delete, listFields (v2)
- ✅ Deals: list (v2)
- ✅ Persons: list, get by ID (v2) **NEW**
- ✅ Users: getUser, listUsers (v1)

#### Authors: 1

- Daniel Klotz ([@d-klotz](https://github.com/d-klotz))

---

# v1.0.0 (Mon Oct 21 2024)

:tada: **Major Version Release - V1 Module Pattern Migration** :tada:

This release represents a complete refactoring of the Pipedrive API module to align with the Frigg Framework v1 module pattern.

#### 💥 Breaking Changes

- **Removed ModuleManager pattern**: Migrated from legacy `ModuleManager` class to modern `definition.js` pattern
- **Removed Mongoose models**: Credential and Entity models now handled by Frigg core framework
- **Simplified exports**: Module now exports only `{Api, Definition}` instead of multiple classes
- **Environment variable change**: `PIPEDRIVE_SCOPES` → `PIPEDRIVE_SCOPE` (singular) for consistency

#### 🚀 Enhancement

- **V1 Module Pattern**: Implemented modern `definition.js` with `requiredAuthMethods`
- **OAuth2 Flow**: Streamlined authentication using Frigg's built-in OAuth2Requester
- **Domain Handling**: Enhanced `setTokens()` to properly capture and validate `api_domain` from token response
- **Error Handling**: Added comprehensive try-catch blocks with contextual error messages in all auth methods
- **Type Safety**: Added explicit `String()` coercion for external IDs to prevent type mismatches
- **Domain Validation**: Added automatic `https://` prefix handling in `setCompanyDomain()`
- **Documentation**: Added JSDoc comments to key API methods for better maintainability
- **Fallback Values**: Added `'Unknown Company'` fallback for missing company names
- **Consistency**: Aligned environment variable naming with other v1 modules (Attio, HubSpot, Frontify)

#### 🐛 Bug Fix

- Fixed `baseURL()` function → `baseUrl` property for consistency with other v1 modules
- Fixed authorization URI to use `scope` from parent OAuth2Requester class
- Improved token refresh handling to maintain company domain through refresh cycles
- Added validation to prevent API calls with undefined domain

#### 🏗️ Refactoring

- **Deleted**: `manager.js` (191 lines) - replaced by `definition.js`
- **Deleted**: `models/credential.js` - replaced by Frigg core credential persistence
- **Deleted**: `models/entity.js` - replaced by Frigg core entity management
- **Created**: `definition.js` - new v1 module definition with OAuth2 auth methods
- **Updated**: `api.js` - enhanced with validation, error handling, and documentation
- **Updated**: `index.js` - simplified exports to `{Api, Definition}`

#### 📦 Migration Guide

If you're upgrading from v0.x to v1.0.0:

1. Update environment variable: `PIPEDRIVE_SCOPES` → `PIPEDRIVE_SCOPE`
2. Update imports: `const {ModuleManager} = require('@friggframework/api-module-pipedrive')` → `const {Definition} = require('@friggframework/api-module-pipedrive')`
3. Use new module definition pattern in integration classes
4. Remove any direct references to `Credential` or `Entity` models (now handled by Frigg core)

#### 🎯 API Coverage (Unchanged)

- ✅ Activities: list, create, update, delete, listFields
- ✅ Deals: list
- ✅ Users: getUser, listUsers

#### Authors: 1

- Daniel Klotz ([@d-klotz](https://github.com/d-klotz))

---

# v0.10.0 (Wed Mar 20 2024)

:tada: This release contains work from new contributors! :tada:

Thanks for all your work!

:heart: Nicolas Leal ([@nicolasmelo1](https://github.com/nicolasmelo1))

:heart: nmilcoff ([@nmilcoff](https://github.com/nmilcoff))

#### 🚀 Enhancement

#### 🐛 Bug Fix

- correct some bad automated edits, though they are not in relevant
  files ([@MichaelRyanWebber](https://github.com/MichaelRyanWebber))
- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 4

- [@MichaelRyanWebber](https://github.com/MichaelRyanWebber)
- Nicolas Leal ([@nicolasmelo1](https://github.com/nicolasmelo1))
- nmilcoff ([@nmilcoff](https://github.com/nmilcoff))
- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.9.0 (Wed Sep 06 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.26 (Thu Jun 08 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.25 (Thu May 25 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.24 (Tue Apr 04 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.23 (Tue Feb 21 2023)

#### 🐛 Bug Fix

- Merge branch 'main' into hubspot-updates ([@seanspeaks](https://github.com/seanspeaks))
- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.21 (Tue Jan 31 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.19 (Wed Jan 11 2023)

#### 🐛 Bug Fix

- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.18 (Tue Jan 10 2023)

:tada: This release contains work from a new contributor! :tada:

Thank you, Jonathan O'Donnell ([@joncodo](https://github.com/joncodo)), for all your work!

#### 🐛 Bug Fix

- Merge branch 'main' of github.com:friggframework/frigg into doc-updates ([@joncodo](https://github.com/joncodo))
- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 2

- Jonathan O'Donnell ([@joncodo](https://github.com/joncodo))
- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.17 (Mon Jan 09 2023)

#### 🐛 Bug Fix

- Merge remote-tracking branch 'origin/main' into
  gitbook-updates [#48](https://github.com/friggframework/frigg/pull/48) ([@seanspeaks](https://github.com/seanspeaks))
- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))
- A lot of changes all rolled into
  one [#21](https://github.com/friggframework/frigg/pull/21) ([@seanspeaks](https://github.com/seanspeaks))
- Updated API modules with support for sls offline, and made sure optional chaining with discriminators was in
  place ([@seanspeaks](https://github.com/seanspeaks))
- Fixing dependencies across all API Modules ([@seanspeaks](https://github.com/seanspeaks))
- More import issues (Exports are named objects, imports needed to object
  destructure) ([@seanspeaks](https://github.com/seanspeaks))
- Updates to API Modules for proper export/imports ([@seanspeaks](https://github.com/seanspeaks))
- Merge remote-tracking branch 'origin/main' into
  simplify-mongoose-models ([@seanspeaks](https://github.com/seanspeaks))
- Update all api modules to use module-plugin models ([@seanspeaks](https://github.com/seanspeaks))
- Add READMEs for all packages and
  api-modules [#20](https://github.com/friggframework/frigg/pull/20) ([@seanspeaks](https://github.com/seanspeaks))
- Add READMEs for all packages and api-modules ([@seanspeaks](https://github.com/seanspeaks))

#### ⚠️ Pushed to `main`

- Merge branch 'main' into gitbook-updates ([@seanspeaks](https://github.com/seanspeaks))
- Finish initial formatting and publishing of all modules ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.14 (Tue Dec 06 2022)

#### 🐛 Bug Fix

- fix modules to
  @friggframework [#74](https://github.com/friggframework/frigg/pull/74) ([@sheehantoufiq](https://github.com/sheehantoufiq))
- Bump independent versions \[skip ci\] ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 2

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))
- Sheehan Toufiq Khan ([@sheehantoufiq](https://github.com/sheehantoufiq))

---

# v0.8.11 (Mon Sep 19 2022)

#### 🐛 Bug Fix

- Test environment setup for all
  modules [#49](https://github.com/friggframework/frigg/pull/49) ([@seanspeaks](https://github.com/seanspeaks))
- Test environment setup for all modules ([@seanspeaks](https://github.com/seanspeaks))
- Merge remote-tracking branch 'origin/main' into
  gitbook-updates [#48](https://github.com/friggframework/frigg/pull/48) ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))

---

# v0.8.10 (Thu Sep 01 2022)

#### 🐛 Bug Fix

- version bumped to address tag
  issue [#43](https://github.com/friggframework/frigg/pull/43) ([@seanspeaks](https://github.com/seanspeaks))
- version bumped ([@seanspeaks](https://github.com/seanspeaks))
- Publish ([@seanspeaks](https://github.com/seanspeaks))
- Add nx and
  licenses [#37](https://github.com/friggframework/frigg/pull/37) ([@seanspeaks](https://github.com/seanspeaks))
- MIT to all packages ([@seanspeaks](https://github.com/seanspeaks))

#### Authors: 1

- Sean Matthews ([@seanspeaks](https://github.com/seanspeaks))
