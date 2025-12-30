# Submitting Fenestra to the OpenAPI Initiative

> Guide for submitting Fenestra as an OAI companion specification.

---

## Overview

**Target**: OpenAPI Initiative (OAI), a Linux Foundation Collaborative Project

**Model**: Companion specification (like Arazzo, Overlay)

**Timeline**: 12-24 months from proposal to v1.0.0 release

---

## Spec Family Positioning

```
OpenAPI Specification → Describes REST APIs
├── Arazzo            → Describes API Workflows
├── Overlay           → Augments OpenAPI documents
└── Fenestra          → Describes Platform UI Extensibility ← NEW
```

**Elevator Pitch**:
> "Just as Arazzo extends OpenAPI to describe workflows, Fenestra extends the ecosystem to describe UI component ecosystems. HubSpot, Canva, Slack, and Stripe struggle to document their platform UI constraints in a standardized way. Fenestra solves this."

---

## Required Documents

### Before Proposal

| Document | Status | Notes |
|----------|--------|-------|
| Specification schema | ✅ Done | `fenestra-spec.yaml` |
| README with use cases | ✅ Done | 8 use cases documented |
| Platform examples | 🔶 Partial | Need 5+ complete specs |
| JSON Schema validator | ❌ Needed | Reference implementation |
| GOVERNANCE.md | ❌ Needed | Copy OAI pattern |
| CONTRIBUTING.md | ❌ Needed | Contribution guidelines |

### For Working Group Formation

| Document | Status | Notes |
|----------|--------|-------|
| Working group charter | ❌ Needed | Define scope and goals |
| Committed participants list | ❌ Needed | 2-3 organizations minimum |
| Development roadmap | 🔶 Partial | See TASKS.md |
| Reference implementation | ❌ Needed | CLI validator + generator |

---

## Working Group Requirements

### Do We Need One?

**Yes** - OAI specs are developed by Special Interest Groups (SIGs).

### Minimum Requirements

- **Core contributors**: 3-5 active people
- **Organizations**: 2-3 different companies
- **Platform vendor**: At least 1 willing to provide test specs
- **Membership fees**: None for technical participation

### Formation Process

1. Present proposal to OAI community
2. Get TSC (Technical Steering Committee) interest
3. Form SIG with charter
4. Request `OAI/Fenestra-Specification` repository
5. Begin public development

---

## Submission Process

### Phase 1: Foundation (Months 1-2)

- [ ] Finalize spec v0.2.0
- [ ] Create 5+ complete platform examples
- [ ] Build reference implementation (validator CLI)
- [ ] Add GOVERNANCE.md and CONTRIBUTING.md
- [ ] Identify 2-3 committed organizations

### Phase 2: Community Engagement (Months 2-4)

- [ ] Contact OAI: contact@openapis.org
- [ ] Join OAI Slack workspace
- [ ] Present at OAI TSC meeting (weekly, open to public)
- [ ] Post in GitHub discussions
- [ ] Attend apidays or similar conference

### Phase 3: SIG Formation (Months 4-6)

- [ ] Formal proposal to OAI Business Governing Board
- [ ] Working group charter approved
- [ ] `OAI/Fenestra-Specification` repo created
- [ ] Weekly SIG meetings begin
- [ ] Public development starts

### Phase 4: Development (Months 6-18)

- [ ] Iterate on spec based on feedback
- [ ] Build tooling ecosystem (validators, generators, IDE plugins)
- [ ] Get platform vendors to validate specs
- [ ] Grow contributor base

### Phase 5: Release (Months 18-24)

- [ ] TSC review of v1.0.0-rc.1
- [ ] Implementers' Draft testing period (3-6 months)
- [ ] Address feedback, fix issues
- [ ] TSC approval of v1.0.0
- [ ] Announcement at apidays conference

---

## Governance Structure

```
Community Proposal → GitHub Issues/Discussions
         ↓
  Working Group / SIG Development
         ↓
  TSC Technical Review (Weekly)
         ↓
  Consensus achieved? → YES → Approved
         ↓ NO
  Escalate to Technical Oversight Board
```

### Key Bodies

| Body | Role |
|------|------|
| **TSC** | Technical decisions, spec approval |
| **BGB** | Business strategy, budget |
| **SIG** | Day-to-day spec development |
| **Linux Foundation** | Legal, infrastructure |

---

## Tooling Requirements

### Minimum for Proposal

1. **Validator CLI**
   ```bash
   fenestra validate ./hubspot.fenestra.yaml
   ```

2. **JSON Schema**
   - Machine-readable schema for spec validation
   - Can use the existing `fenestra-spec.yaml`

### Recommended for 1.0.0

1. **Code generators**
   - Generate SDK bindings from spec
   - Generate TypeScript types
   - Generate documentation

2. **IDE extensions**
   - VS Code extension with autocomplete
   - Schema validation in editor

3. **Documentation generator**
   - Auto-generate developer docs from spec

---

## Key Contacts

| Resource | URL |
|----------|-----|
| OAI Website | https://www.openapis.org/ |
| OAI GitHub | https://github.com/OAI |
| Contact Email | contact@openapis.org |
| TSC Meetings | Check openapis.org calendar |
| Arazzo (reference) | https://github.com/OAI/Arazzo-Specification |
| Overlay (reference) | https://github.com/OAI/Overlay-Specification |

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| OAI declines | Show real platform use cases, get vendor endorsements |
| Long timeline | Build adoption while in draft, publish 0.x versions |
| Small market | Focus on high-value platforms, integrate with existing tools |
| TSC requirements | Build contributor base first, TSC emerges naturally |

---

## Immediate Next Steps

1. **Build validator CLI** - Reference implementation
2. **Create 5 complete platform specs** - HubSpot, Slack, Stripe, Figma, Zendesk
3. **Recruit working group** - Find 2-3 committed organizations
4. **Draft proposal** - Executive summary for OAI leadership
5. **Contact OAI** - Send proposal package

---

## See Also

- [README.md](./README.md) - Spec overview and use cases
- [PLATFORMS.md](./PLATFORMS.md) - Target platform list
- [TASKS.md](./TASKS.md) - Development progress
- [ISSUES.md](./ISSUES.md) - Known gaps to address
