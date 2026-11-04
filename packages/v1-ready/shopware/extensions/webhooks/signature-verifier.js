const { Api } = require('../../api');

const SECRET_HEADER = 'X-Api-Secret';

/**
 * Verify a Shop-Ware webhook request.
 *
 * Shop-Ware sets the partner `X-Api-Secret` on every webhook delivery.
 * Docs: https://shop-ware.stoplight.io/docs/public-api/dgrb4a8slxf6k-webhooks
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Partner API secret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyShopWareSecret({ req, secret }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }
    return new Api({ api_secret: secret }).verifyWebhookSecret({
        headers: req.headers || {},
        secret,
    });
}

module.exports = {
    verifyShopWareSecret,
    SECRET_HEADER,
};
