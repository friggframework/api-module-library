# Fenestra Specification - Known Issues & Roadmap

This document captures findings from adversarial review of the v0.1.0-draft specification.

## Summary of Findings

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Platform Ecosystem | 3 | 4 | 3 | 3 |
| MCP/JSON Forms Integration | 9 | 7 | 4 | 0 |
| Policy Edge Cases | 6 | 6 | 6 | 2 |
| Web Standards Mapping | 5 | 4 | 4 | 3 |

---

## Critical Issues (Must Fix for v0.2)

### 1. Declarative/JSON UI Patterns Not Supported

**Problem**: Cannot describe platforms using JSON-based UI (Slack Block Kit, Discord, Microsoft Adaptive Cards).

**Platforms affected**: Slack, Discord, Microsoft Teams, Zoom Apps

**Required addition**:
```yaml
ComponentDefinitionStyle:
  enum:
    - sdkImport      # Current: import { Button } from '@sdk'
    - jsonPayload    # NEW: {"type": "button", "text": "..."}
    - htmlTemplate   # NEW: <button>...</button>
    - dsl            # NEW: Custom domain-specific language
```

### 2. Mobile SDK Ecosystems Completely Missing

**Problem**: No support for iOS/Android native platforms.

**Required additions**:
- Package managers: CocoaPods, Swift Package Manager, Android AAR, Flutter
- Platform field on SDK: web, ios, android, desktop, cli
- Language field: swift, kotlin, dart

### 3. No Internationalization/Localization Support

**Problem**: Zero support for RTL layouts, translations, or locale-specific components.

**Required addition**: `I18nSupport` schema with locales, RTL, and translation keys.

### 4. MCP Apps Integration Superficial

**Problem**: `MCPAppsIntegration` lacks:
- UI Resource schema (how to declare UI in server manifests)
- Template definitions (form structure, layout, validation)
- Tool-to-UI bindings (connecting tools to UI surfaces)
- User consent mechanism for UI-initiated tool calls
- Bidirectional JSON-RPC communication details

### 5. JSON Forms Integration Incomplete

**Problem**: `JSONFormsIntegration` lacks:
- UI Schema structure (layouts, rules, options)
- Custom renderer specification (tester functions, ranking)
- Array control support (add/remove/reorder)
- Validation and error display patterns
- Categorization support (tabs, accordions, wizards)

### 6. AI Agent Interaction Not Addressed

**Problem**: Spec mentions AI agents but provides zero mechanisms for:
- UI capability discovery by agents
- Dynamic UI rendering from conversation context
- User response handling and tool parameter collection

### 7. Arazzo Integration Missing

**Problem**: Spec mentions Arazzo but has no schema for:
- Workflow step to UI binding
- Form submission as workflow input
- UI feedback on workflow progress

### 8. Compliance Requirements Missing

**Problem**: No way to express:
- Accessibility standards (WCAG AA/AAA, Section 508)
- Security certifications (SOC2, HIPAA, PCI-DSS, FedRAMP)
- Privacy regulations (GDPR, CCPA, COPPA)
- Data residency requirements

### 9. ARIA Coverage Insufficient

**Problem**: Single `ariaRole` field cannot express:
- ARIA states and properties (49 attributes)
- Composite patterns (combobox, tree, menu)
- Live region announcements
- APG pattern references

---

## High Priority Issues (v0.2 or v0.3)

### 10. Theming System Underdeveloped

**Problem**: Only `designTokensProvided: boolean`, no:
- Dark/light mode specification
- Theme token schema (colors, spacing, typography)
- CSS custom properties integration

### 11. Heavy React Bias

**Problem**: Spec assumes React. Missing support for:
- Vue/Angular/Svelte/Solid
- CSS-only libraries (Mirotone)
- No-code/low-code builders
- Framework-agnostic patterns

### 12. Hybrid Component Requirements

**Problem**: Binary required/optional doesn't capture:
- Per-category requirements (SDK for forms, custom for charts)
- Per-extension-point requirements
- Feature-tier requirements

### 13. Publishing Tier Complexity

**Problem**: Only private/public/marketplace tiers. Missing:
- Beta/early access programs
- Partner tier hierarchies
- Regional/geographic policies
- Industry-specific tiers

### 14. Review Workflow Complexity

**Problem**: Simple boolean flags can't express:
- Multi-stage review pipelines
- Parallel vs sequential reviews
- Conditional review requirements
- Component-level vs app-level review

### 15. CSS Layout Patterns Missing

**Problem**: No CSS layout information:
- Flexbox/Grid assumptions
- Responsive breakpoints
- Container query support
- Design token exposure

### 16. Form Semantics Missing

**Problem**: No form participation semantics:
- HTML5 constraint validation API
- FormData integration
- Autocomplete/autofill support

---

## Medium Priority Issues (v0.3+)

### 17. Versioning and Deprecation Tracking

**Problem**: Simple `deprecated: boolean` and `since: string`. Need:
- Sunset dates
- Migration guides
- Breaking change documentation
- Version compatibility matrix

### 18. Browser Extension Patterns

**Problem**: Missing extension point types:
- popup, sidepanel, devtools, contentScript

### 19. Event Model Underdeveloped

**Problem**: Simple event schema lacks:
- DOM event equivalents
- Event bubbling/composition
- Touch/gesture events
- Keyboard event expectations

### 20. Custom Component Nuances

**Problem**: Binary allowed/not-allowed. Need:
- Wrapper requirements
- Use-case-specific allowances
- Approved third-party library lists

### 21. Time-Based Policies

**Problem**: No time dimension:
- Deprecation timelines
- Migration windows
- Feature flag lifecycles
- Policy version transitions

---

## Roadmap

### v0.2.0 - Core Completeness
- [ ] Add `ComponentDefinitionStyle` for JSON/declarative UI
- [ ] Add `I18nSupport` schema
- [ ] Expand `MCPAppsIntegration` with resource/template/binding schemas
- [ ] Expand `JSONFormsIntegration` with UI schema/validation/renderers
- [ ] Add `ArazzoIntegration` schema
- [ ] Add `ComplianceRequirements` schema
- [ ] Expand ARIA to include states, properties, and composite patterns

### v0.3.0 - Policy Maturity
- [ ] Add granular `ComponentRequirementPolicy` (per-category, per-extension-point)
- [ ] Expand `CustomComponentPolicy` with approved libraries, wrapper requirements
- [ ] Add `ReviewWorkflow` schema with multi-stage, conditional logic
- [ ] Add `PublishingTier` hierarchy (beta, partner levels, regional)
- [ ] Add `LifecyclePolicy` for time-based policies

### v0.4.0 - Web Standards Depth
- [ ] Expand `WebStandardMapping` with multi-element structures
- [ ] Add `CSSLayoutPattern` schema
- [ ] Add `FormSemantics` schema
- [ ] Expand event model with DOM equivalents
- [ ] Add mobile platform equivalents

### v1.0.0 - Production Ready
- [ ] Full cross-platform support (web, iOS, Android, desktop)
- [ ] AI agent interaction mechanisms
- [ ] Tooling for validation and code generation
- [ ] Reference implementations for major platforms

---

## Required Tooling

### Spec Validator (Critical - Required for OAI Submission)

A reference implementation that validates Fenestra documents:

```bash
# Validate a Fenestra spec
fenestra validate ./hubspot.fenestra.yaml

# Output
✓ Schema valid
✓ Required fields present
✓ SDK references resolved
✓ Component bindings valid
✗ Warning: Component 'CustomButton' not in catalog
```

**Requirements**:
- JSON Schema validation against `fenestra-spec.yaml`
- Reference resolution ($ref support)
- Custom validation rules (SDK exists, components match)
- CLI interface
- Programmatic API (JavaScript/TypeScript)

**Repository**: `fenestra-tools` or part of main spec repo

### Code Generator (High Priority)

Generate SDK bindings and types from Fenestra specs:

```bash
# Generate TypeScript types
fenestra generate --platform hubspot --output ./src/types

# Generate React component stubs
fenestra generate --platform hubspot --template react --output ./src/components
```

### Documentation Generator (Medium Priority)

Auto-generate developer docs from specs:

```bash
fenestra docs --platform hubspot --output ./docs
```

### IDE Extension (Medium Priority)

VS Code extension with:
- Autocomplete for Fenestra YAML
- Schema validation
- Component catalog browsing
- Quick navigation to SDK docs

---

## See Also

- [SUBMISSION.md](./SUBMISSION.md) - OAI submission guide
- [PLATFORMS.md](./PLATFORMS.md) - Target platform list
- [TASKS.md](./TASKS.md) - Development progress
