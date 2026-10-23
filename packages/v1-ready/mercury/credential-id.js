const crypto = require('crypto');

/**
 * Stable, non-reversible credential external id.
 *
 * Reimplements the Left Hook `_shared/credential-id` helper used by the
 * pre-port Mercury definition: hash `moduleName` plus any identifying parts
 * (account id, user id, …) so credentials stay unique per install without
 * storing raw secrets as identifiers.
 *
 * @param {string} moduleName
 * @param {...(string|number|null|undefined)} parts
 * @returns {string} hex sha256 digest
 */
function credentialExternalId(moduleName, ...parts) {
    const material = [moduleName, ...parts]
        .filter((p) => p !== undefined && p !== null && p !== '')
        .map(String)
        .join(':');
    return crypto.createHash('sha256').update(material).digest('hex');
}

module.exports = { credentialExternalId };
