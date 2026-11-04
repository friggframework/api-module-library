const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Listrak Cross Channel REST API client.
 *
 * Auth: OAuth 2.0 client_credentials (no browser redirect).
 *   POST https://auth.listrak.com/OAuth2/Token
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=client_credentials&client_id=…&client_secret=…
 *   → Authorization: Bearer <access_token> (expires_in ≈ 3600)
 *
 * Base URL: https://api.listrak.com/crosschannel/v1
 *
 * Official docs / OpenAPI:
 *   https://api.listrak.com/crosschannel/v1/docs
 *   https://api-docs.tools.listrak.com/cross-channel/llms.txt
 *   https://api-docs.tools.listrak.com/cross-channel/openapi.json
 *   https://api-docs.tools.listrak.com/cross-channel/guides/authentication.md
 *
 * Credentials must come from an Integration of type **Cross Channel**
 * (Email/SMS credentials are not interchangeable).
 *
 * The curated contract in ./crosschannel.openapi.yaml mirrors this client
 * 1:1 (one method per operationId). Keep them in sync.
 *
 * Webhook subscription management is NOT offered on this API surface.
 * There is no public create/update for Event Configurations via REST —
 * those are configured in the Listrak application.
 */

const PRODUCTION_BASE_URL = 'https://api.listrak.com/crosschannel/v1';
const PRODUCTION_TOKEN_URI = 'https://auth.listrak.com/OAuth2/Token';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super({
            ...params,
            grant_type: 'client_credentials',
        });

        this.client_id =
            get(params, 'client_id', null) || get(params, 'clientId', null);
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'clientSecret', null);
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null);

        const overrideBase =
            get(params, 'base_url', null) || get(params, 'baseUrl', null);
        const overrideToken =
            get(params, 'token_uri', null) || get(params, 'tokenUri', null);

        this.baseUrl = overrideBase || PRODUCTION_BASE_URL;
        this.tokenUri = overrideToken || PRODUCTION_TOKEN_URI;

        // Client-credentials tokens are re-minted, not refresh_token rotated.
        this.isRefreshable = true;

        // No authorization-code redirect for this API.
        this.authorizationUri = null;

        this.URLs = {
            eventConfigurations: '/eventConfigurations',
            eventConfigurationByUid: (eventUID) =>
                `/eventConfigurations/${eventUID}`,
            events: (eventUID) =>
                `/eventConfigurations/${eventUID}/events`,
        };
    }

    /**
     * JSON-Schema form for collecting Cross Channel Integration credentials.
     * Client ID / Secret come from Integrations → Integration Management
     * (integration type Cross Channel).
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    title: 'Cross Channel Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'From Listrak → Integrations → Integration Management on an Integration of type Cross Channel.',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Paired with Client ID for the OAuth client_credentials grant. Shown once at creation and cannot be retrieved later.',
                    },
                },
            },
        };
    }

    /**
     * Listrak requires application/x-www-form-urlencoded with
     * grant_type / client_id / client_secret (no scope in official Cross
     * Channel docs). The core OAuth2Requester default posts JSON; override
     * to match Authentication guidance.
     *
     * @see https://api-docs.tools.listrak.com/cross-channel/guides/authentication.md
     */
    async getTokenFromClientCredentials() {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** Alias for callers / capability manifest that expect a getToken name. */
    async getToken() {
        return this.getTokenFromClientCredentials();
    }

    /**
     * Client-credentials auth has no refresh_token. Authenticated means we
     * either hold a Bearer token or can mint one from client_id + secret.
     */
    isAuthenticated() {
        return !!(
            this.access_token ||
            (this.client_id && this.client_secret)
        );
    }

    async ensureAccessToken() {
        const skewMs = 60 * 1000;
        if (
            this.access_token &&
            this.accessTokenExpire &&
            Date.now() < this.accessTokenExpire.getTime() - skewMs
        ) {
            return this.access_token;
        }
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'CrossChannel: client_id and client_secret are required to obtain an access token.'
            );
        }
        await this.getTokenFromClientCredentials();
        return this.access_token;
    }

    async _authedGet(options) {
        await this.ensureAccessToken();
        return this._get(options);
    }

    async _authedPost(options) {
        await this.ensureAccessToken();
        return this._post(options);
    }

    // ---- Event configurations ----------------------------------------------

    /**
     * Get all event configurations.
     * GET /eventConfigurations
     *
     * Response: { data: [ { eventUID, eventName } ], meta: { statusCode, message, errors } }
     *
     * @see https://api-docs.tools.listrak.com/cross-channel/reference/event-configurations.md
     */
    async getEventConfigurations() {
        return this._authedGet({
            url: this.baseUrl + this.URLs.eventConfigurations,
        });
    }

    /**
     * Get a Custom Event Configuration (schema + feature access).
     * GET /eventConfigurations/{eventUID}
     *
     * Response: {
     *   data: {
     *     eventUID, eventName,
     *     eventSchemaAttrs: { fieldName: 'String'|'Int'|'Double'|'Date', ... },
     *     featureAccess: [ 'Workflow' ]
     *   },
     *   meta: { ... }
     * }
     *
     * operationId in the official OpenAPI is `getSchemaByEventUid`.
     *
     * @see https://api-docs.tools.listrak.com/cross-channel/reference/event-configurations.md
     */
    async getSchemaByEventUid(eventUID) {
        if (eventUID == null || eventUID === '') {
            throw new Error('CrossChannel: eventUID is required.');
        }
        return this._authedGet({
            url: this.baseUrl + this.URLs.eventConfigurationByUid(eventUID),
        });
    }

    // ---- Events ------------------------------------------------------------

    /**
     * Post new Custom Events for a configuration.
     * POST /eventConfigurations/{eventUID}/events
     *
     * body: {
     *   events: [
     *     {
     *       identifiers: [
     *         { identifierType: 'EmailAddress'|'PhoneNumber'|'MobileContactUid',
     *           identifierValue: string }
     *       ],
     *       dataFields: { [schemaField]: string }
     *     }
     *   ]
     * }
     *
     * A HTTP 200 is not a per-recipient success receipt — each group in
     * `data[]` carries its own statusCode.
     *
     * @see https://api-docs.tools.listrak.com/cross-channel/reference/events.md
     * @see https://api-docs.tools.listrak.com/cross-channel/guides/errors.md
     */
    async postEvents(eventUID, body) {
        if (eventUID == null || eventUID === '') {
            throw new Error('CrossChannel: eventUID is required.');
        }
        return this._authedPost({
            url: this.baseUrl + this.URLs.events(eventUID),
            headers: { 'Content-Type': 'application/json' },
            body: body || {},
        });
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    PRODUCTION_TOKEN_URI,
};
