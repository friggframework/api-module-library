/**
 * Dealertrack dealer / customer → canonical Company / Contact (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names are best-effort from Opentrack
 * Customer/Dealer domain concepts (CustomerNumber, name, contact fields)
 * publicly visible on ot.dms.dealertrack.com ASMX docs; REST response shapes
 * are not published as an open OpenAPI.
 *
 * Skipped (do not fit an existing canonical schema cleanly):
 * - repairOrder — DMS service RO, not a support@1 Ticket
 * - vehicle / part / laborOperation / technician / serviceAdvisor — no
 *   matching business@1 / support@1 / billing@1 object
 * - invoice / payment — could later map to billing@1 once that schema and
 *   verified REST field names are available; omitted here rather than invent
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Opentrack CustomerAPI: https://ot.dms.dealertrack.com/CustomerAPI.asmx
 * - Opentrack program overview:
 *   https://us.dealertrack.com/resources/dealertrack-dms-opentrack-integration/
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const businessMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        dealer: [
            {
                to: 'Company',
                identity: ['externalIds.dealertrack', 'id'],
                fields: {
                    id: 'remote_id',
                    name: 'name',
                },
                ops: ['read'],
            },
        ],
        customer: [
            {
                to: 'Contact',
                identity: ['externalIds.dealertrack', 'id'],
                fields: {
                    id: 'remote_id',
                    name: 'name',
                    firstName: 'first_name',
                    lastName: 'last_name',
                    email: 'email',
                    phone: 'phone',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { businessMapping };
