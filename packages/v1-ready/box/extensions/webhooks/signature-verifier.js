const { Api } = require('../../api');

/**
 * Re-export Box V2 signature verification for the webhook extension.
 *
 * Docs: https://developer.box.com/guides/webhooks/v2/signatures-v2/
 */
function verifyBoxSignature({
    req,
    primaryKey = process.env.BOX_WEBHOOK_PRIMARY_KEY,
    secondaryKey = process.env.BOX_WEBHOOK_SECONDARY_KEY,
}) {
    return Api.verifyWebhookSignature({
        req,
        primaryKey,
        secondaryKey,
    });
}

module.exports = {
    verifyBoxSignature,
};
