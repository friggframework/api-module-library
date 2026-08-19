const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Fireflies.ai API module.
 *
 * Fireflies exposes a single GraphQL endpoint at https://api.fireflies.ai/graphql.
 * Every call is an HTTP POST whose JSON body is `{ query, variables }`.
 * Auth is a bearer token: `Authorization: Bearer <api key>`.
 *
 * Auth design note:
 * ApiKeyRequester.addAuthHeaders() sets `headers[this.api_key_name] = this.api_key`.
 * Fireflies needs the value prefixed with the word "Bearer", so we override
 * addAuthHeaders() to emit `Authorization: Bearer <key>` from the raw key. This
 * keeps the stored credential clean (just the key, no "Bearer " prefix) while
 * still producing the exact header Fireflies requires. (The alternative —
 * api_key_name='Authorization' with a 'Bearer '-prefixed api_key — also works;
 * the override is used so the persisted secret is the bare key.)
 *
 * Docs:
 *   https://docs.fireflies.ai/graphql-api/authorization
 *   https://docs.fireflies.ai/graphql-api/query/transcripts
 *   https://docs.fireflies.ai/graphql-api/query/transcript
 */
class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.fireflies.ai/graphql';

        // Accept the key under any of the common param names.
        const apiKey =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        this.api_key_name = 'Authorization';
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    /**
     * Emit `Authorization: Bearer <key>`. The stored credential is the bare
     * key; the "Bearer " prefix is added here so it never lives in the DB.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        return h;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Fireflies.ai Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'From fireflies.ai: Integrations > Fireflies API > copy your API key.',
                        'ui:placeholder': 'Fireflies API key',
                    },
                },
            },
        };
    }

    /**
     * Core GraphQL transport. Posts `{ query, variables }` to the single
     * endpoint and unwraps `data`, throwing on a GraphQL `errors` array.
     */
    async graphql(query, variables = {}) {
        const options = {
            url: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: { query, variables },
        };
        const response = await this._post(options);
        if (response && Array.isArray(response.errors) && response.errors.length) {
            const message = response.errors
                .map((e) => e.message)
                .filter(Boolean)
                .join('; ');
            throw new Error(`Fireflies GraphQL error: ${message}`);
        }
        return response ? response.data : undefined;
    }

    // ---- Auth / identity ------------------------------------------------

    /**
     * The authenticated user. Used by the module's auth-test / entity flow.
     * `query { user { user_id name email } }`
     */
    async getUser() {
        const query = `query {
            user {
                user_id
                name
                email
                is_admin
            }
        }`;
        const data = await this.graphql(query);
        return data ? data.user : undefined;
    }

    // ---- Transcripts ----------------------------------------------------

    /**
     * List meeting transcripts, newest first. All args optional.
     * `transcripts(limit, skip, fromDate, toDate, organizers, participants,
     *  keyword, mine)`
     *
     * Note: the public signature still accepts a single `organizerEmail` /
     * `participantEmail` string; Fireflies deprecated the scalar
     * `organizer_email` / `participant_email` args in favor of the array
     * `organizers: [String]` / `participants: [String]`, so a single email is
     * wrapped in an array internally.
     */
    async listTranscripts(params = {}) {
        const query = `query ListTranscripts(
            $limit: Int
            $skip: Int
            $fromDate: DateTime
            $toDate: DateTime
            $organizers: [String]
            $participants: [String]
            $keyword: String
            $mine: Boolean
        ) {
            transcripts(
                limit: $limit
                skip: $skip
                fromDate: $fromDate
                toDate: $toDate
                organizers: $organizers
                participants: $participants
                keyword: $keyword
                mine: $mine
            ) {
                id
                title
                date
                dateString
                duration
                host_email
                organizer_email
                participants
                meeting_link
                transcript_url
                meeting_attendees {
                    displayName
                    email
                    name
                    phoneNumber
                    location
                }
            }
        }`;

        const variables = {};
        if (params.limit !== undefined) variables.limit = params.limit;
        if (params.skip !== undefined) variables.skip = params.skip;
        if (params.fromDate !== undefined) variables.fromDate = params.fromDate;
        if (params.toDate !== undefined) variables.toDate = params.toDate;
        if (params.organizerEmail !== undefined)
            variables.organizers = Array.isArray(params.organizerEmail)
                ? params.organizerEmail
                : [params.organizerEmail];
        if (params.participantEmail !== undefined)
            variables.participants = Array.isArray(params.participantEmail)
                ? params.participantEmail
                : [params.participantEmail];
        if (params.keyword !== undefined) variables.keyword = params.keyword;
        if (params.mine !== undefined) variables.mine = params.mine;

        const data = await this.graphql(query, variables);
        return data ? data.transcripts : [];
    }

    /**
     * A single transcript with full detail: attendees (with emails),
     * summary, and every sentence.
     * `transcript(id: ID!)`
     */
    async getTranscript(id) {
        const query = `query GetTranscript($id: String!) {
            transcript(id: $id) {
                id
                title
                date
                dateString
                duration
                host_email
                organizer_email
                participants
                meeting_link
                transcript_url
                audio_url
                video_url
                meeting_attendees {
                    displayName
                    email
                    name
                    phoneNumber
                    location
                }
                speakers {
                    id
                    name
                }
                summary {
                    overview
                    short_summary
                    keywords
                    action_items
                    bullet_gist
                    gist
                    outline
                    shorthand_bullet
                    topics_discussed
                }
                sentences {
                    index
                    speaker_name
                    speaker_id
                    text
                    start_time
                    end_time
                }
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.transcript : undefined;
    }

    /**
     * Just the AI summary block for a transcript.
     */
    async getTranscriptSummary(id) {
        const query = `query GetTranscriptSummary($id: String!) {
            transcript(id: $id) {
                id
                title
                summary {
                    overview
                    short_summary
                    keywords
                    action_items
                    bullet_gist
                    gist
                    outline
                    shorthand_bullet
                    topics_discussed
                }
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.transcript : undefined;
    }

    /**
     * Keyword search across transcripts. Thin wrapper over listTranscripts.
     */
    async searchTranscripts(keyword, params = {}) {
        return this.listTranscripts({ ...params, keyword });
    }
}

module.exports = { Api };
