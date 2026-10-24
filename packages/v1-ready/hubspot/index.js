const {Api} = require('./api');
const {Definition} = require('./definition');
const Config = require('./defaultConfig');
const webhooks = require('./extensions/webhooks');
const fields = require('./fields');
const { ReconcileHubSpotSubscriptions } = require('./scripts/reconcile-subscriptions');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
        webhooks,
    },
    fields,
    scripts: [ReconcileHubSpotSubscriptions],
};
