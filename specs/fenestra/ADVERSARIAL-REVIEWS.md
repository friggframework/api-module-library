# Fenestra v0.1.0 Adversarial Reviews

Generated: 2025-12-27

These reviews were conducted by adversarial agents to identify gaps, inconsistencies, and areas for improvement in the Fenestra specification before OAI submission.

---

## Table of Contents

1. [Spec Consistency Review](#1-spec-consistency-review)
2. [Platform Implementer Review](#2-platform-implementer-review)
3. [Developer Experience Review](#3-developer-experience-review)
4. [Security & Governance Review](#4-security--governance-review)
5. [Synthesis & Recommendations](#5-synthesis--recommendations)

---

## 1. Spec Consistency Review

**Perspective:** Standards body reviewer checking for internal consistency, OAI format compliance, and ambiguities.

### CRITICAL ISSUES (must fix before submission)

#### 1.1 Broken Schema Architecture: Inline vs Referenced Objects

**Location**: Throughout spec, particularly Extension Point configuration objects

**Problem**: The prose defines ~40+ discrete object types (e.g., `ResponseSchemaObject`, `EndpointObject`, `InteractivityObject`, `RuntimeObject`, etc.) with anchor links and separate documentation sections. However, the JSON schema **inlines** these as nested anonymous objects instead of using `$ref` to reusable `$defs` entries.

**Example**:
- **Prose** (line 678): `schema | [Response Schema Object](#responseSchemaObject) | JSON Schema definition for valid responses.`
- **Schema** (line 773-791): Defines `schema` as an inline anonymous object, not a `$ref`

**Why This Matters**:
- OAI specs (OpenAPI, Arazzo) use `$ref` extensively for reusable components
- Tools cannot validate references to these "objects" that don't exist as `$defs`
- Inconsistent with OAI specification patterns
- Makes schema composition and reuse impossible

**Fix Required**: Either:
1. Extract all prose-documented objects to `$defs` and use `$ref` (RECOMMENDED for OAI submission), OR
2. Flatten prose to match inline schema structure (removes semantic clarity)

---

#### 1.2 Missing Discriminated Union for `extensionTypeConfig`

**Location**: `/specs/fenestra/versions/0.1.0.md` line 619

**Problem**: Prose says:
```
extensionTypeConfig | [JSON Response Config Object] | [Coded Components Config Object] | ...
  | Configuration specific to the extension type.
```

This implies a **discriminated union** based on `extensionType` value.

**Schema** (line 715-718) says:
```json
"extensionTypeConfig": {
  "type": "object",
  "description": "Configuration specific to the extension type. Schema varies based on extensionType value."
}
```

This accepts **any object** with no validation!

**Why This Matters**:
- No validation that `extensionTypeConfig` matches `extensionType`
- Could pass validation with `extensionType: "iframe"` but `extensionTypeConfig: {sdk: "..."}` (coded components config)
- Critical for tooling correctness

**Fix Required**: Use JSON Schema conditional validation:
```json
"allOf": [
  {
    "if": {"properties": {"extensionType": {"const": "jsonResponse"}}},
    "then": {"properties": {"extensionTypeConfig": {"$ref": "#/$defs/JsonResponseConfig"}}}
  },
  // ... repeat for each extensionType
]
```

---

#### 1.3 Missing `patternProperties` for Specification Extensions

**Location**: Multiple objects claim to support `x-` extensions but lack schema enforcement

**Objects Missing Pattern Properties**:
- `DeclarativeSchema` (prose line 1027 says "MAY be extended", schema line 1171 has no `patternProperties`)
- `I18n` (prose line 1098, schema line 1205)
- `Compliance` (prose line 1233, schema line 1266)
- `AgentInteraction` (prose line 1455, schema line 1370)

**Fix Required**: Add to all affected object definitions:
```json
"patternProperties": {
  "^x-": {}
}
```

---

#### 1.4 Broken Internal Anchor Links

**Location**: `/specs/fenestra/versions/0.1.0.md` line 110

**Problem**:
```markdown
This is the root object of a [Fenestra Description](#fenestraDescription).
```

But there is NO `<a name="fenestraDescription"></a>` anchor tag anywhere in the document.

**Fix Required**: Add anchors to all Definition sections and ensure references match

---

#### 1.5 Inconsistent Enum Definitions (Prose vs Schema)

**Location**: AgentProtocol `name` field

**Prose** (line 1512):
```
name | string | **REQUIRED**. Protocol name. Values include: `mcp`, `openai-functions`,
  `anthropic-tools`, `langchain-tools`, `custom`.
```

Note: Says "Values **include**" (not "MUST be one of")

**Schema** (line 1388):
```json
"name": { "type": "string" }
```

No enum constraint at all!

**Fix Required**:
1. If closed enum: Change prose to "MUST be one of" and add enum to schema
2. If open enum: Clarify prose to say "MAY include the following well-known values"

---

#### 1.6 Version Pattern Mismatch

**Prose** (line 81): Only mentions `major.minor`, with no discussion of patch versions

**Schema** (line 12): Requires `major.minor.patch` and allows pre-release tags

**Fix Required**: Clarify prose to explicitly state full `major.minor.patch` format

---

### MAJOR ISSUES (should fix)

1. **Inconsistent Terminology**: "Map[X, Y]" in prose vs JSON Schema object+additionalProperties
2. **Ambiguous RFC 2119 Usage**: "MAY be used by tooling as required" is contradictory
3. **Missing Schema Hosting Information**: Schema `$id` URI not mentioned in prose
4. **No Validation for Cross-References**: String identifiers can reference non-existent objects
5. **Inconsistent Default Value Documentation**: Some inline, some separate
6. **JSON Schema Draft Version Mismatch**: Prose claims 2020-12, schema uses draft-07

### MINOR ISSUES

1. Example coverage gaps (missing complete examples)
2. Inconsistent capitalization in enum values
3. No guidance on multi-document support
4. Vague external references
5. No deprecation strategy

---

## 2. Platform Implementer Review

**Perspective:** Platform engineers from HubSpot, Shopify, Salesforce, Slack, Figma evaluating adoption feasibility.

### DEAL BREAKERS

#### 2.1 Cannot Express Multi-Context Architectures
**Affected platforms:** Figma, VS Code, Electron-based apps, browser extensions

Fenestra assumes a single execution context. Real platforms have:
- **Figma:** Main thread (plugin logic) + UI thread (rendering) with message passing
- **VS Code:** Extension host process + webview panel
- **Browser extensions:** Background worker + content script + popup

The 5 extension types all assume single-context. No mechanism to describe separate execution contexts, message passing protocols, or context-specific API access.

---

#### 2.2 Backend/Serverless Requirements Are Invisible
**Affected platforms:** HubSpot, Shopify, Salesforce, Slack

Most platforms require backend infrastructure alongside UI:
- **HubSpot:** Serverless functions required for data manipulation
- **Shopify:** Webhook endpoints required for event subscriptions
- **Slack:** HTTP endpoints required for slash commands, interactivity

A developer reading the Fenestra doc would have no idea they need to build a web server.

---

#### 2.3 Hybrid Extension Models Cannot Be Represented
**Affected platforms:** Shopify, Salesforce, Microsoft Teams

Real platforms use **multiple extension types simultaneously** for a single app:

**Shopify example:**
- Settings page: iframe
- Embedded admin app: iframe with App Bridge SDK
- Checkout UI: Polaris React components
- App embeds on storefront: Liquid templates + JavaScript

Extension points only support a single `extensionType`. Cannot express these hybrid patterns.

---

#### 2.4 Legacy Framework Support Is Impossible
**Affected platforms:** Salesforce, SharePoint, Dynamics 365

Enterprise platforms have multiple generations of component systems:
- **Salesforce:** Visualforce (2008) + Aura (2014) + LWC (2019)

No mechanism to express multiple component systems, migration paths, or feature parity differences.

---

### SIGNIFICANT GAPS

1. **State Management Model Undefined**: Who owns state? Platform or developer?
2. **Authentication Flows Underspecified**: Only 4 enum values, no token refresh, SSO, etc.
3. **Build/Deployment Model Missing**: Who hosts? How to deploy?
4. **Testing/Dev Workflow Invisible**: Local dev, hot reload, test environments
5. **Rate Limits and Quotas Absent**: Every platform has limits
6. **Performance Requirements Underspecified**: Bundle size, render time, memory
7. **Error Handling Undefined**: What happens when things fail?
8. **Versioning and Breaking Changes**: No compatibility matrix

### AWKWARD FITS

1. App Bridge / Message Passing Systems (calling it "iframe" undersells the pattern)
2. CSS-Only Component Libraries (not really "SDK exports")
3. Adaptive Cards / Block Kit connection to declarativeSchemas
4. CDN-Only SDKs That Aren't Packages
5. Mobile vs Web SDK Relationship
6. Theming Scope (only under embeddedSdkConfig, should be platform-level?)

### ADOPTION ESTIMATES

| Platform | Fit | Notes |
|----------|-----|-------|
| HubSpot | 75% | Coded components fit well, missing serverless/deploy |
| Miro | 85% | Optional components model works, missing local dev |
| Slack | 60% | Block Kit fits, missing state management, webhooks |
| Shopify | 40% | Hybrid model doesn't fit, App Bridge misrepresented |
| Salesforce | 25% | Multiple frameworks can't coexist, too complex |
| Figma | 20% | Multi-context architecture cannot be expressed |

---

## 3. Developer Experience Review

**Perspective:** Tooling developers building IDE plugins, code generators, AI assistants, documentation generators.

### TOOLING BLOCKERS

#### 3.1 Props Schema is Broken for Type Generation

```yaml
props:
  onClick:
    type: function  # NOT VALID JSON SCHEMA!
```

JSON Schema doesn't have a `function` type. TypeScript generators will crash or generate `any`.

---

#### 3.2 Polymorphic extensionTypeConfig is Untyped

```json
"extensionTypeConfig": {
  "type": "object"  // No discriminator, no oneOf
}
```

Type generators create `extensionTypeConfig: any`. No validation of config shape.

---

#### 3.3 SDK Export Metadata is Too Weak

SDK exports only have `type` and `description`. Missing:
- Import style (named vs default export)
- Parameters/props schema
- Return type
- Whether it needs side-effect imports (CSS)

Code generators can't create proper import statements.

---

#### 3.4 Component Identifier Ambiguity

Components referenced by string keys everywhere:
- `componentCatalog.components.Button`
- `supportedComponents: ["Button"]`
- `sdkBinding.export: "Button"`

Are these guaranteed to match? Case-sensitive? No canonical identifier exists.

---

#### 3.5 Event Payload Schemas are Undefined

```json
"payload": {
  "type": "object"  // No schema!
}
```

Can't generate event handler types. Don't know what data events contain.

---

### USABILITY ISSUES

1. No import path construction rules
2. Weak typing for string arrays (supportedComponents, context.provides)
3. Props schema format inconsistency (is it properties section or full schema?)
4. No composition validation rules (can Button contain Modal?)
5. `"all"` magic string in supportedComponents

### MISSING INFORMATION

1. No type definition linking (where is ButtonProps interface?)
2. Component children/slot requirements unclear
3. No SDK version to component availability matrix
4. Missing event handler signatures
5. No context data schemas
6. Component examples not machine-parseable
7. No build/bundle requirements
8. Missing deprecation timeline

### DX IMPROVEMENTS SUGGESTED

1. Add $ref support for component props
2. Provide machine-readable import examples
3. Add OpenAPI links for runtime data
4. Include visual reference data (thumbnails, Storybook links)
5. Add accessibility testing metadata
6. Provide component dependency graph
7. Add performance characteristics

---

## 4. Security & Governance Review

**Perspective:** CISO evaluating whether to approve Fenestra-documented integrations for production use.

### NOTE ON SCOPE

Many security concerns are about **platform implementation**, not the specification itself. The spec is a description format - it cannot enforce security. However, the spec SHOULD:
1. Provide vocabulary for describing security posture
2. Document best practices
3. Include Security Considerations section
4. Recommend what tooling should validate

### SECURITY VULNERABILITIES

#### 4.1 Agent Permission Model is Coarse-Grained

```yaml
agentPermissions:
  canPerformActions: true  # Can DELETE EVERYTHING
```

Boolean flags with no resource-level scoping. An AI agent with `canPerformActions: true` could execute destructive operations.

**Recommendation**: Add granular permission model with resource scoping.

---

#### 4.2 No Authentication Mechanism for Agent Interactions

The specification describes agent protocols but omits:
- How agents authenticate to platforms
- Session management
- Token validation
- Permission revocation

**Recommendation**: Add authentication section to agentInteraction.

---

#### 4.3 JSON Schema Injection in Declarative Schemas

`schemaUrl` allows arbitrary URI references, enabling:
- SSRF (Server-Side Request Forgery)
- Schema poisoning with circular dependencies
- XSS via documentation URLs

**Recommendation**: Document URL validation requirements in Security Considerations.

---

#### 4.4 CSP and Sandbox Configuration Not Validated

CSP policies are just strings with no validation:

```yaml
sandboxing:
  cspPolicy: "default-src *; script-src 'unsafe-inline' 'unsafe-eval' *"
```

**Recommendation**: Document minimum CSP requirements and what tooling SHOULD validate.

---

#### 4.5 No Subresource Integrity for SDK/CDN References

SDKs loaded from CDN have no integrity checks:

```yaml
sdks:
  stripe-js:
    cdn: https://js.stripe.com/v3/
    cdnRequired: true
    # Missing: integrity hash
```

**Recommendation**: Add optional `integrity` field, document SRI best practices.

---

### COMPLIANCE GAPS

1. **Shared Responsibility Model Has No Legal Weight**: Just descriptive strings
2. **GDPR/CCPA Claims Are Unsubstantiated Booleans**: No evidence required
3. **Accessibility Compliance is Self-Declared**: No VPAT, no audit reports
4. **Security Certifications Cannot Be Verified**: No certificate numbers, audit periods
5. **Data Retention Policy is Underspecified**: Only three options
6. **PII Handling Lacks Classification**: Binary flags for complex topic
7. **User Rights Implementation Incomplete**: Only 2 of 8 GDPR rights covered
8. **No Audit Trail Requirements**: Zero mentions of logging

### GOVERNANCE CONCERNS

1. **Fenestra Documents Cannot Be Trusted**: No signing, no verification
2. **Malicious Capability Advertisements**: Platforms can lie about security features
3. **Version Security Updates Missing**: No CVE tracking, no security mailing list
4. **Extension Point Constraints Not Enforced**: supportedComponents not validated
5. **Custom Component Approval Process Undefined**: Who approves? SLA?
6. **Security Review Scope is Inadequate**: Private apps may get no review
7. **No Incident Response Plan**: Zero guidance when incidents occur
8. **No Change Management**: Documents can change silently
9. **No Third-Party Risk Management**: Subprocessors, dependencies
10. **No Legal Framework**: Liability, indemnification unclear

### AGENT INTERACTION RISKS

1. **Prompt Injection via Template Schemas**: Malicious descriptions
2. **Template Output Hijacking**: UI returns data agent shouldn't trust
3. **Interaction Chaining Attacks**: Data exfiltration via chained templates
4. **Event Callback Spoofing**: Fake events to agent
5. **Context Poisoning**: Inject commands into conversation history
6. **Protocol Downgrade Attacks**: Force insecure protocol
7. **UI Invocation Privilege Escalation**: Hidden UI for approvals

### RECOMMENDATIONS FOR SPEC

The spec should add a **Security Considerations** section addressing:

1. **Document Trust**: Recommend signing, describe trust model
2. **Tooling Validation**: What validators SHOULD check
3. **Agent Security**: Authentication, rate limiting, permission scoping recommendations
4. **Compliance Evidence**: How to provide verifiable compliance claims
5. **URL Validation**: What URLs are safe to fetch
6. **CSP Best Practices**: Minimum viable CSP policies
7. **Incident Response**: Recommend security contact, disclosure policy

---

## 5. Synthesis & Recommendations

### Priority Matrix

| Priority | Category | Issue | Effort |
|----------|----------|-------|--------|
| P0 | Schema | `extensionTypeConfig` needs discriminated union | Medium |
| P0 | Schema | Extract prose objects to `$defs` with `$ref` | High |
| P0 | Schema | Add `patternProperties` for `x-` extensions | Low |
| P0 | Docs | Fix broken anchor links | Low |
| P0 | Schema | Align JSON Schema draft version | Low |
| P1 | Coverage | Add multi-context architecture support | High |
| P1 | Coverage | Add backend/infrastructure requirements | High |
| P1 | Coverage | Support multiple extension types per extension point | Medium |
| P1 | DX | Fix props schema (function type invalid) | Medium |
| P1 | DX | Add import path construction rules | Medium |
| P1 | Security | Add Security Considerations section | Medium |
| P1 | Security | Add agent authentication recommendations | Medium |
| P2 | Coverage | Add state management model | Medium |
| P2 | Coverage | Expand authentication flows | Medium |
| P2 | Coverage | Add deployment/hosting model | Medium |
| P2 | DX | Add type definition linking | Medium |
| P2 | DX | Add context data schemas | Medium |
| P2 | Security | Add granular permission model | Medium |
| P2 | Compliance | Expand user rights coverage | Low |
| P3 | DX | Add component dependency graph | Low |
| P3 | DX | Add performance characteristics | Low |
| P3 | Coverage | Add rate limits/quotas | Low |

### Key Insight: Scope of Specification

The security review highlighted an important distinction:

**What Fenestra IS:**
- A description format for platform UI ecosystems
- A vocabulary for documenting capabilities
- A schema for tooling to parse and understand platforms

**What Fenestra IS NOT:**
- An enforcement mechanism
- A security protocol
- A compliance certification

Many "security vulnerabilities" are really platform implementation concerns. The spec can't make platforms secure, but it CAN:
1. Provide vocabulary to describe security posture
2. Document best practices for spec authors
3. Recommend validation for tooling
4. Include Security Considerations section

### Recommended Next Steps

1. **Fix P0 issues** before OAI submission (schema consistency, anchors)
2. **Add Security Considerations section** documenting trust model and best practices
3. **Consider phased approach** for coverage gaps (core spec v0.1, extensions v0.2)
4. **Engage platform partners** to validate real-world fit (HubSpot, Shopify, Slack)
5. **Build reference tooling** that demonstrates validation patterns

---

*End of Adversarial Reviews*
