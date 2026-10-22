/**
 * The contract-2 parts of the HubSpot webhooks extension (ADR-054 §2), used by `defineIntegration` in
 * @friggframework/core. Core runs them; this file holds only HubSpot facts:
 *
 *   verify      the v3 signature (method + URL + raw body + timestamp, 5 minutes), at receipt, no database
 *   receive     one item per event in HubSpot's batch, keyed by portalId (the entity externalId)
 *   normalize   HubSpot subscription types to the emitted names, with the record (hydrated when asked)
 *   subscriptions  app scope: HubSpot v3 subscriptions belong to the developer app, not to a portal
 *
 * No @friggframework/core import: the bundle is plain data and functions, so the module works with any core.
 */
const { verifyHubSpotSignature } = require('./signature-verifier');

/** Subscription verb -> emitted verb. Other types (merge, restore, associationChange) are not emitted yet. */
const VERBS = { creation: 'created', propertyChange: 'changed', deletion: 'deleted' };
/** Object name in a subscription type -> CRM object type for batch reads. */
const OBJECT_TYPES = { contact: 'contacts', company: 'companies', deal: 'deals' };

/**
 * The delivery as core hands it to `verify` (the same object IntegrationBase#webhookVerificationInput builds:
 * `{ headers, body, query, rawBody, method, url }`), turned into the request shape the v3 verifier reads.
 */
function requestFromInput(input = {}) {
    const headers = { ...(input.headers || {}) };
    let originalUrl = '';
    if (input.url) {
        const u = new URL(input.url);
        originalUrl = `${u.pathname}${u.search}`;
        headers.host = u.host;
        headers['x-forwarded-host'] = u.host;
        headers['x-forwarded-proto'] = u.protocol.replace(/:$/, '');
    }
    return { method: input.method || 'POST', headers, originalUrl, url: originalUrl, rawBody: input.rawBody, body: input.body };
}

function verify(input, { env = {} } = {}) {
    return verifyHubSpotSignature({ req: requestFromInput(input), clientSecret: env.HUBSPOT_CLIENT_SECRET });
}

function receive(input = {}) {
    const events = Array.isArray(input.body) ? input.body : [];
    return events.map((event) => ({ externalId: event?.portalId, body: event }));
}

/**
 * HubSpot events -> `{ name, payload }`. `deal.propertyChange` becomes `deal.changed` with
 * `{ deal, changes: { dealstage: { to } }, event }`. With `hydrate`, the record is batch-read with the
 * installation's credential (`true`: default properties; a list: those properties).
 */
async function normalize(batch = [], { api, options = {} } = {}) {
    const out = [];
    for (const event of batch) {
        const [object, kind] = String(event?.subscriptionType || '').split('.');
        if (!OBJECT_TYPES[object] || !VERBS[kind]) continue;
        // The Api builds record URLs for the portal it is connected to; a delivery says which one that is.
        if (api && (api.portalId === null || api.portalId === undefined)) api.portalId = String(event.portalId);
        const id = String(event.objectId);
        const changes = kind === 'propertyChange' ? { [event.propertyName]: { to: event.propertyValue } } : {};
        let record = { id, properties: kind === 'propertyChange' ? { [event.propertyName]: event.propertyValue } : {} };
        if (options.hydrate && kind !== 'deletion' && api) {
            const properties = Array.isArray(options.hydrate) ? options.hydrate : undefined;
            const res = await api.batchReadObjects(OBJECT_TYPES[object], { inputs: [{ id }], ...(properties ? { properties } : {}) });
            record = res?.results?.[0] || record;
        }
        out.push({ name: `${object}.${VERBS[kind]}`, payload: { [object]: record, changes, event } });
    }
    return out;
}

const developer = (env) => ({ appId: env.HUBSPOT_APP_ID, developerApiKey: env.HUBSPOT_DEVELOPER_API_KEY });

/** A subscription key is `eventType` or `eventType:propertyName` (what `use(hubspot, { webhooks: { subscribe } })` lists). */
const subscriptions = {
    scope: 'app',
    desired: (options) => options.subscribe || [],
    key: (sub) => (sub.propertyName ? `${sub.eventType}:${sub.propertyName}` : sub.eventType),
    list: (api, env) => api.listWebhookSubscriptions(developer(env)),
    create: (api, env, key) => {
        const [eventType, propertyName] = String(key).split(':');
        return api.createWebhookSubscription({ ...developer(env), eventType, ...(propertyName ? { propertyName } : {}) });
    },
    remove: (api, env, sub) => api.deleteWebhookSubscription({ ...developer(env), subscriptionId: sub.id }),
};

const emits = {};
for (const object of Object.keys(OBJECT_TYPES)) for (const verb of Object.values(VERBS)) emits[`${object}.${verb}`] = {};

/** The JSON Schema of `use(hubspot, { webhooks: <options> })`. */
const options = {
    type: 'object',
    properties: {
        subscribe: { type: 'array', items: { type: 'string' }, description: 'eventType or eventType:propertyName, e.g. deal.propertyChange:dealstage' },
        hydrate: { oneOf: [{ type: 'boolean' }, { type: 'array', items: { type: 'string' } }], default: false },
    },
    required: ['subscribe'],
    additionalProperties: false,
};

module.exports = { verify, receive, normalize, subscriptions, emits, options, requestFromInput, VERBS, OBJECT_TYPES };
