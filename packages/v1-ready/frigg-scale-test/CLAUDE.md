# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Context (Read First)
- **Tech Stack**: TypeScript, Node.js, ts-jest, native fetch API
- **Main Purpose**: Mock CRM API client for Frigg Framework scalability testing
- **Core Architecture**: Simple REST API client (FriggScaleTestAPI) with Frigg Framework integration definition (authDef)
- **Key Integration**: @friggframework/core for module definition structure
- **Platform Support**: NPM package published as `@friggframework/api-module-frigg-scale-test`
- **DO NOT**: Use external HTTP libraries (axios, node-fetch) - uses native fetch only

## Module Architecture

This is a **simplified API module** without OAuth2 complexity, used for scalability testing:

### Two-Component Structure
- **api.ts**: `FriggScaleTestAPI` class - Simple API client with bearer token authentication
- **index.ts**: Exports `authDef` (Frigg module definition) and `FriggScaleTestAPI`

Unlike typical Frigg API modules, this module:
- Does NOT extend OAuth2Requester (uses simple API key auth)
- Does NOT have a separate Definition class
- Does NOT have defaultConfig.json
- Exports `authDef` object directly instead of Definition class

### API Client Design (api.ts)
```typescript
export class FriggScaleTestAPI {
  constructor(readonly opts: { baseUrl?: string; apiKey?: string } = {})

  // Environment-aware configuration
  private get base(): string  // Defaults to process.env or localhost:4000
  private headers(): Record<string, string>  // Bearer token authentication

  // Core endpoints
  async health()
  async getConfig(accountId: string)
  async putConfig(accountId: string, cfg: any)
  async listContacts(params: ListParams)
  async listActivities(params: ListActivitiesParams)
  async createActivity(body: any)
  async requestContactsExport(body: {...})
  async requestActivitiesExport(body: {...})
  async getExportJob(jobId: string)
}
```

### Frigg Integration (index.ts)
Exports `authDef` object implementing `FriggModuleAuthDefinition`:
- **apiPropertiesToPersist**: Only `credential: ["apiKey"]` (no OAuth tokens)
- **getToken**: Returns undefined (no OAuth flow)
- **getEntityDetails**: Creates synthetic entity ID from accountId param
- **getCredentialDetails**: Returns static credential identifier
- **testAuthRequest**: Validates auth by calling health endpoint

## Development Commands

### Build
```bash
npm run build  # Compiles TypeScript to dist/ with declarations
```

### Testing
```bash
npm test  # Runs Jest with ts-jest in runInBand mode
```

### Linting
```bash
npm run lint  # ESLint check
```

## Test Architecture

### Test Server Setup (test/smoke.test.ts)
The test suite includes a sophisticated local server setup:
1. **Lambda Handler Proxy**: Wraps AWS Lambda handler from `services/frigg-scale-test-lambda`
2. **APIGatewayProxyEventV2 Conversion**: Converts HTTP requests to Lambda events
3. **Dynamic Port Binding**: Server binds to random port (listen(0))
4. **Environment Configuration**: Sets `FRIGG_SCALE_TEST_BASE_URL` to local server

This allows testing against the actual Lambda handler locally without deploying.

### Path Aliasing
Both TypeScript and Jest use path mapping:
- `services/*` resolves to `../../../services/*`
- Allows importing Lambda handler: `import { handler } from "services/frigg-scale-test-lambda/src/handler"`

## Environment Variables
- **FRIGG_SCALE_TEST_BASE_URL**: API base URL (defaults to http://localhost:4000)
- **FRIGG_SCALE_TEST_API_KEY**: Bearer token for authentication

## Key Differences from Standard Frigg Modules
1. **No OAuth2Requester**: Simple constructor-based configuration
2. **No Definition class**: Uses authDef object export
3. **TypeScript-first**: Written in TS, not JS with JSDoc
4. **Native fetch**: No external HTTP client dependencies
5. **Simplified auth**: API key only, no token refresh logic
6. **Test complexity**: Includes Lambda handler proxy for realistic testing

## API Endpoint Patterns
- **Pagination**: Uses cursor-based pagination with optional limit
- **Filtering**: Supports updatedSince, type, contactId filters
- **Bulk Operations**: Async export jobs with status polling (202 accepted)
- **Error Handling**: Throws Error with HTTP status on non-OK responses

## Important Files
- **src/api.ts:13-138**: Main API client implementation
- **src/index.ts:4-24**: Frigg Framework integration definition
- **test/smoke.test.ts:62-91**: Local Lambda server setup in beforeAll hook
- **src/types.d.ts:1-9**: Type declarations for @friggframework/core
- **src/handler-proxy.d.ts:1-4**: Lambda handler type proxy
