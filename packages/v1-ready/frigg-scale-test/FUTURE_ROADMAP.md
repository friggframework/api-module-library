# Future Roadmap

This document tracks features that were part of the original specification but have been commented out or removed to simplify the initial implementation. These may be added back in future iterations.

## Removed Features

### Activities
- **listActivities**: List activities with filtering by type, contactId, and delta sync
- **createActivity**: Create new activities (phone calls, emails, SMS)
- Activity types supported: phone_call, email, sms

### Bulk Export Operations
- **requestContactsExport**: Request bulk export of contacts in NDJSON/CSV format
- **requestActivitiesExport**: Request bulk export of activities
- **getExportJob**: Poll export job status and retrieve download URL

### Configuration Management
- **getConfig**: Retrieve per-account configuration (page size, rate limits, latency simulation, error rates)
- **putConfig**: Update per-account configuration for testing different scenarios

### Mutation Tracking
- **Hybrid change-log**: Track create/update/delete operations on contacts and activities
- Persistent state layer for testing delta sync and webhook simulations

## Rationale for Removal

The current focus is on providing a simple, deterministic synthetic data generator for contact scale testing. The above features added complexity around:
- HTTP communication layers
- State persistence and management
- Multiple entity types
- Advanced testing scenarios

These can be incrementally added back as needed for more sophisticated testing scenarios.

## Implementation Notes for Future

When re-implementing these features, consider:
1. The lambda handler in `/services/frigg-scale-test-lambda` may need updates
2. OpenAPI spec in `frigg-scale-test-mock-crm.yaml` can be expanded
3. Maintain deterministic generation for all synthetic data
4. Consider memory efficiency for bulk operations

