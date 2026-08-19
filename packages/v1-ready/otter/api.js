const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Otter.ai Public API client.
 *
 * Otter.ai historically had NO public developer API — only an unofficial,
 * reverse-engineered community client existed. That changed: Otter shipped an
 * official **Public API** (help-center article last updated April 23, 2026),
 * available for Enterprise workspaces. It is a Bearer-token authenticated REST
 * surface rooted at `https://api.otter.ai/v1` that exposes channels,
 * conversations, transcripts, audio, action items, insights, outlines, workspace
 * details, and workspace webhooks (conversation.completed / conversation.shared).
 *
 * Auth: an API key minted under Integrations → Developer → Create key, sent as
 * `Authorization: Bearer <key>`. We model that on top of ApiKeyRequester by
 * setting the header NAME to `Authorization` and the header VALUE to
 * `Bearer <token>`; the raw token is kept separately (`api_token`) so it can be
 * persisted and re-hydrated without double-prefixing.
 *
 * Docs: https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API
 *       https://help.otter.ai/hc/en-us/articles/35634832371735-Workspace-Webhooks
 */
class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);

        // Accept the token under any of the friendly names, tolerate a caller
        // that already prefixed "Bearer ", and store the raw token once.
        const raw =
            get(params, 'api_token', null) ||
            get(params, 'access_token', null) ||
            get(params, 'api_key', null);
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.api_token = token;
        // ApiKeyRequester.addAuthHeaders() sets headers[api_key_name] = api_key.
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.baseUrl = 'https://api.otter.ai/v1';

        this.URLs = {
            workspace: '/workspace',
            channels: '/channels',
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            conversationTranscript: (id) => `/conversations/${id}/transcript`,
            conversationAudio: (id) => `/conversations/${id}/audio`,
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Otter.ai Authentication',
                    type: 'object',
                    required: ['api_token'],
                    properties: {
                        api_token: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a key in Otter under Integrations → Developer → Create key (Enterprise workspaces only). Sent as the Authorization: Bearer header.',
                        'ui:placeholder': 'Your Otter.ai API key',
                    },
                },
            },
        };
    }

    // ---- Workspace ----------------------------------------------------------

    /** Get the workspace for the authenticated user (id, name, owner, type…). */
    async getWorkspace() {
        return this._get({ url: this.baseUrl + this.URLs.workspace });
    }

    // ---- Channels -----------------------------------------------------------

    /** List channels for the authenticated user (alphabetical by name). */
    async listChannels(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.channels, query });
    }

    // ---- Conversations ------------------------------------------------------

    /**
     * List conversations for the authenticated user. Reverse chronological
     * (most recent first), cursor-based pagination. Supports `cursor` and
     * `page_size`, plus optional filters (e.g. `channel_id`).
     */
    async listConversations(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.conversations, query });
    }

    /**
     * Get one conversation's summary and details. Pass `include` to embed
     * related data: any of `transcript`, `action_items`, `insights`, `outline`,
     * or `all`. Accepts a string or an array (joined with commas).
     */
    async getConversation(conversationId, { include } = {}) {
        const query = {};
        if (include) {
            query.include = Array.isArray(include) ? include.join(',') : include;
        }
        return this._get({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
            query,
        });
    }

    /** Get the full transcript for a conversation. */
    async getConversationTranscript(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationTranscript(conversationId),
        });
    }

    /** Get the audio (download URL / stream reference) for a conversation. */
    async getConversationAudio(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationAudio(conversationId),
        });
    }

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate the API key.
     * A valid key returns 200 with the workspace; an invalid key returns 401,
     * which the requester surfaces as an error.
     */
    async testAuth() {
        return this.getWorkspace();
    }
}

module.exports = { Api };
