const { verifyAirtableContentMac } = require('../../api');

/**
 * Verify an Airtable webhook notification ping.
 *
 * Airtable signs the JSON body with the per-webhook `macSecretBase64` returned
 * once from createWebhook, and sends the digest in `X-Airtable-Content-MAC`.
 *
 * @see https://airtable.com/developers/web/api/webhooks-overview
 */
function verifyAirtableSignature({ req, macSecretBase64 }) {
    return verifyAirtableContentMac({
        headers: (req && req.headers) || {},
        rawBody: req && req.rawBody,
        body: req && req.body,
        macSecretBase64,
    });
}

module.exports = { verifyAirtableSignature };
