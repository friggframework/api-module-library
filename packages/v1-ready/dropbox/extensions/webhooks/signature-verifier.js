const { Api } = require('../../api');

/**
 * Re-export Dropbox webhook signature verification for the webhook extension.
 *
 * Docs: https://www.dropbox.com/developers/reference/webhooks
 */
function verifyDropboxSignature({
    req,
    appSecret = process.env.DROPBOX_CLIENT_SECRET,
}) {
    return Api.verifyWebhookSignature({
        req,
        appSecret,
    });
}

module.exports = {
    verifyDropboxSignature,
};
