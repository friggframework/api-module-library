const { Definition } = require('../../definition');

/**
 * Resolve a Gorgias account subdomain to a Frigg integration id.
 * Entity externalId is the Gorgias domain/subdomain (see definition.js).
 */
async function findIntegrationBySubdomain(ctx, subdomain) {
    if (!subdomain) return null;
    if (
        !ctx ||
        !ctx.commands ||
        typeof ctx.commands.findIntegrationByEntityExternalId !== 'function'
    ) {
        throw new Error(
            'gorgias-webhooks: commands.findIntegrationByEntityExternalId is required'
        );
    }
    return ctx.commands.findIntegrationByEntityExternalId(
        String(subdomain),
        Definition.moduleName
    );
}

module.exports = { findIntegrationBySubdomain };
