/**
 * Convert a plain object into a JSON Patch (RFC 6902) document for Rev.io
 * PATCH endpoints, which require Content-Type: application/json-patch+json.
 *
 * Docs: https://developers.rev.io/docs/make-a-request
 *
 * Nested objects become nested paths (e.g. { finance: { bill_profile_id: 1 } }
 * → [{ op: 'replace', path: '/finance/bill_profile_id', value: 1 }]).
 */
function formatPatchBody(currentPath = '/', obj = {}) {
    let patchArray = [];
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (
            value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            const nextPath = `${currentPath}${key}/`;
            patchArray = patchArray.concat(formatPatchBody(nextPath, value));
        } else {
            patchArray.push({
                op: 'replace',
                path: `${currentPath}${key}`,
                value,
            });
        }
    }
    return patchArray;
}

module.exports = formatPatchBody;
