/**
 * Verify a Figma Webhooks V2 delivery by comparing the `passcode` field in the
 * JSON body to the passcode configured when the webhook was created.
 *
 * Official docs (https://developers.figma.com/docs/rest-api/webhooks-security/):
 * Figma does not sign webhooks with a header; the passcode in the payload is
 * the verification mechanism. On mismatch, respond 400 so Figma stops the
 * webhook.
 *
 * @param {object} params
 * @param {object} params.body - Parsed JSON body from the webhook POST
 * @param {string} params.expectedPasscode - Passcode supplied at webhook create
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyFigmaPasscode({ body, expectedPasscode }) {
    if (!expectedPasscode) {
        return {
            valid: false,
            reason: 'missing expected passcode (FIGMA_WEBHOOK_PASSCODE)',
        };
    }
    if (!body || typeof body !== 'object') {
        return { valid: false, reason: 'missing or non-object body' };
    }
    if (typeof body.passcode !== 'string' || body.passcode.length === 0) {
        return { valid: false, reason: 'body.passcode missing' };
    }
    if (body.passcode !== expectedPasscode) {
        return { valid: false, reason: 'passcode mismatch' };
    }
    return { valid: true };
}

module.exports = { verifyFigmaPasscode };
