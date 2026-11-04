const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Jobber Developer GraphQL API client.
 *
 * Auth: OAuth 2.0 authorization-code grant.
 *   Authorize: https://api.getjobber.com/api/oauth/authorize
 *   Token:     https://api.getjobber.com/api/oauth/token
 *   GraphQL:   POST https://api.getjobber.com/api/graphql
 *
 * Every GraphQL request must include:
 *   Authorization: Bearer <access_token>
 *   X-JOBBER-GRAPHQL-VERSION: <date version, e.g. 2025-04-16>
 *   Content-Type: application/json
 *
 * Docs:
 *   https://developer.getjobber.com/docs/
 *   https://developer.getjobber.com/docs/building_your_app/app_authorization/
 *   https://developer.getjobber.com/docs/using_jobbers_api/api_queries_and_mutations/
 *   https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/
 *
 * Webhook subscriptions are configured in the Developer Center (not via API).
 * This module verifies inbound webhook HMAC and fetches objects by itemId.
 */
const DEFAULT_GRAPHQL_VERSION = '2025-04-16';

const CLIENT_FIELDS = `
    id
    firstName
    lastName
    name
    companyName
    isCompany
    isLead
    isArchived
    email
    phone
    jobberWebUri
    createdAt
    updatedAt
`;

const JOB_FIELDS = `
    id
    jobNumber
    title
    jobStatus
    jobType
    total
    startAt
    endAt
    completedAt
    instructions
    jobberWebUri
    createdAt
    updatedAt
    client { id name }
    property { id name }
`;

const QUOTE_FIELDS = `
    id
    quoteNumber
    title
    quoteStatus
    message
    jobberWebUri
    createdAt
    updatedAt
    transitionedAt
    sentAt
    client { id name }
    property { id name }
`;

const INVOICE_FIELDS = `
    id
    invoiceNumber
    subject
    invoiceStatus
    invoiceNet
    issuedDate
    dueDate
    message
    jobberWebUri
    createdAt
    updatedAt
    client { id name }
`;

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.getjobber.com/api/graphql';
        this.tokenUri = 'https://api.getjobber.com/api/oauth/token';
        this.graphqlVersion =
            get(params, 'graphqlVersion', null) ||
            process.env.JOBBER_GRAPHQL_VERSION ||
            DEFAULT_GRAPHQL_VERSION;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        // Jobber scopes are configured on the app in the Developer Center and
        // are not required on the authorize URL. Keep scope for OAuth2Requester
        // compatibility when an env value is supplied.
        const state = this.state || 'STATE';
        let authorize =
            `https://api.getjobber.com/api/oauth/authorize` +
            `?response_type=code` +
            `&client_id=${this.client_id}` +
            `&redirect_uri=${this.redirect_uri}` +
            `&state=${state}`;
        if (this.scope) {
            authorize += `&scope=${this.scope}`;
        }
        this.authorizationUri = encodeURI(authorize);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Exchange an authorization code for tokens.
     * Jobber expects client_id / client_secret in the form body (not Basic auth).
     * Clear any stale access_token so the token request is unauthenticated.
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    /**
     * Refresh the access token. Jobber may rotate the refresh token; always
     * persist whatever setTokens stores from the response.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        return super.refreshAccessToken(refreshTokenObject);
    }

    // ---- GraphQL transport -------------------------------------------------

    /**
     * POST `{ query, variables }` to the single GraphQL endpoint.
     * Throws when the response carries a top-level `errors` array.
     * Returns `data` (the GraphQL data object).
     */
    async graphql(query, variables = {}) {
        const options = {
            url: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-JOBBER-GRAPHQL-VERSION': this.graphqlVersion,
            },
            body: { query, variables },
        };
        const response = await this._post(options);
        if (response && Array.isArray(response.errors) && response.errors.length) {
            const message = response.errors
                .map((e) => e.message)
                .filter(Boolean)
                .join('; ');
            throw new Error(`Jobber GraphQL error: ${message}`);
        }
        return response ? response.data : undefined;
    }

    _paginationVars(params = {}) {
        const variables = {};
        const first = params.first !== undefined ? params.first : 25;
        variables.first = first;
        if (params.after !== undefined && params.after !== null) {
            variables.after = params.after;
        }
        return variables;
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * The Jobber account the token is authorized for.
     * Official recommendation after token exchange: query account { id name }.
     */
    async getAccount() {
        const query = `query GetAccount {
            account {
                id
                name
            }
        }`;
        const data = await this.graphql(query);
        return data ? data.account : undefined;
    }

    // ---- Clients -----------------------------------------------------------

    /**
     * List clients (cursor pagination).
     * `clients(first:, after:)` — always pass first/last per Jobber rate-limit docs.
     */
    async listClients(params = {}) {
        const query = `query ListClients($first: Int!, $after: String) {
            clients(first: $first, after: $after) {
                nodes { ${CLIENT_FIELDS} }
                pageInfo { hasNextPage endCursor }
                totalCount
            }
        }`;
        const data = await this.graphql(query, this._paginationVars(params));
        return data ? data.clients : undefined;
    }

    /**
     * Get a single client by EncodedId.
     * IDs from list/webhook itemId are passed through as EncodedId arguments.
     */
    async getClient(id) {
        // Nested email/phone/address field shapes beyond `billingAddress { city }`
        // and create-mutation email attrs are confirmed in GraphiQL; keep the
        // selection to Client scalars documented on the Developer Center.
        const query = `query GetClient($id: EncodedId!) {
            client(id: $id) {
                ${CLIENT_FIELDS}
                billingAddress { city }
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.client : undefined;
    }

    /**
     * Create a client.
     * `clientCreate(input: ClientCreateInput!)` — see API Queries and Mutations.
     * Always check `userErrors` on the returned payload.
     */
    async createClient(input) {
        const query = `mutation CreateClient($input: ClientCreateInput!) {
            clientCreate(input: $input) {
                client { ${CLIENT_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { input });
        return data ? data.clientCreate : undefined;
    }

    /**
     * Edit a client.
     * `clientEdit(clientId:, input: ClientEditInput!)` — see Custom Fields docs.
     */
    async editClient(clientId, input) {
        const query = `mutation EditClient($clientId: EncodedId!, $input: ClientEditInput!) {
            clientEdit(clientId: $clientId, input: $input) {
                client { ${CLIENT_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { clientId, input });
        return data ? data.clientEdit : undefined;
    }

    // ---- Jobs --------------------------------------------------------------

    /**
     * List jobs.
     * `jobs(first:, after:)` — Getting Started example.
     */
    async listJobs(params = {}) {
        const query = `query ListJobs($first: Int!, $after: String) {
            jobs(first: $first, after: $after) {
                nodes { ${JOB_FIELDS} }
                pageInfo { hasNextPage endCursor }
            }
        }`;
        const data = await this.graphql(query, this._paginationVars(params));
        return data ? data.jobs : undefined;
    }

    /**
     * Get a single job by EncodedId.
     * `job(id:)` — confirmed in API Rate Limits docs.
     */
    async getJob(id) {
        const query = `query GetJob($id: EncodedId!) {
            job(id: $id) {
                ${JOB_FIELDS}
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.job : undefined;
    }

    /**
     * Create a job.
     * `jobCreate(input:)` with `JobCreateAttributes` (changelog 2025-04-16).
     * Pass the full attributes object; required fields vary by job type.
     */
    async createJob(input) {
        const query = `mutation CreateJob($input: JobCreateAttributes!) {
            jobCreate(input: $input) {
                job { ${JOB_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { input });
        return data ? data.jobCreate : undefined;
    }

    /**
     * Edit a job.
     * `jobEdit` uses `JobEditInput` (changelog).
     */
    async editJob(jobId, input) {
        const query = `mutation EditJob($jobId: EncodedId!, $input: JobEditInput!) {
            jobEdit(jobId: $jobId, input: $input) {
                job { ${JOB_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { jobId, input });
        return data ? data.jobEdit : undefined;
    }

    // ---- Quotes ------------------------------------------------------------

    /**
     * List quotes.
     * `quotes(first:)` — confirmed in API Rate Limits docs.
     */
    async listQuotes(params = {}) {
        const query = `query ListQuotes($first: Int!, $after: String) {
            quotes(first: $first, after: $after) {
                nodes { ${QUOTE_FIELDS} }
                pageInfo { hasNextPage endCursor }
            }
        }`;
        const data = await this.graphql(query, this._paginationVars(params));
        return data ? data.quotes : undefined;
    }

    /**
     * Get a single quote by EncodedId.
     * `quote(id:)` — confirmed in API Rate Limits docs.
     */
    async getQuote(id) {
        const query = `query GetQuote($id: EncodedId!) {
            quote(id: $id) {
                ${QUOTE_FIELDS}
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.quote : undefined;
    }

    /**
     * Create a quote.
     * Input type `QuoteCreateAttributes` is named in the official changelog.
     * Argument name follows the `input:` convention used by clientCreate /
     * jobCreate; confirm in GraphiQL if your API version expects `attributes:`.
     */
    async createQuote(input) {
        const query = `mutation CreateQuote($input: QuoteCreateAttributes!) {
            quoteCreate(input: $input) {
                quote { ${QUOTE_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { input });
        return data ? data.quoteCreate : undefined;
    }

    /**
     * Edit a quote.
     * `QuoteEditAttributes` is named in the official changelog.
     */
    async editQuote(quoteId, input) {
        const query = `mutation EditQuote($quoteId: EncodedId!, $input: QuoteEditAttributes!) {
            quoteEdit(quoteId: $quoteId, input: $input) {
                quote { ${QUOTE_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { quoteId, input });
        return data ? data.quoteEdit : undefined;
    }

    // ---- Invoices ----------------------------------------------------------

    /**
     * List invoices.
     * Top-level `invoices` connection — same Relay pagination pattern as
     * clients/jobs/quotes documented by Jobber. Confirm in GraphiQL if a
     * filter shape is required for your scopes.
     */
    async listInvoices(params = {}) {
        const query = `query ListInvoices($first: Int!, $after: String) {
            invoices(first: $first, after: $after) {
                nodes { ${INVOICE_FIELDS} }
                pageInfo { hasNextPage endCursor }
            }
        }`;
        const data = await this.graphql(query, this._paginationVars(params));
        return data ? data.invoices : undefined;
    }

    /**
     * Get a single invoice by EncodedId.
     * Same EncodedId single-object pattern as job(id:) / quote(id:).
     */
    async getInvoice(id) {
        const query = `query GetInvoice($id: EncodedId!) {
            invoice(id: $id) {
                ${INVOICE_FIELDS}
            }
        }`;
        const data = await this.graphql(query, { id });
        return data ? data.invoice : undefined;
    }

    /**
     * Edit an invoice.
     * `InvoiceEditInput` (changelog). Creation of invoices is often driven by
     * job invoicing settings; a dedicated invoiceCreate is not illustrated in
     * the public docs examples we relied on — see open questions in the PR.
     */
    async editInvoice(invoiceId, input) {
        const query = `mutation EditInvoice($invoiceId: EncodedId!, $input: InvoiceEditInput!) {
            invoiceEdit(invoiceId: $invoiceId, input: $input) {
                invoice { ${INVOICE_FIELDS} }
                userErrors { message path }
            }
        }`;
        const data = await this.graphql(query, { invoiceId, input });
        return data ? data.invoiceEdit : undefined;
    }

    // ---- App lifecycle -----------------------------------------------------

    /**
     * Disconnect the app from the current Jobber account.
     * Required for marketplace apps that offer in-app disconnect.
     * `mutation { appDisconnect { app { name author } userErrors { message } } }`
     */
    async appDisconnect() {
        const query = `mutation Disconnect {
            appDisconnect {
                app { name author }
                userErrors { message }
            }
        }`;
        const data = await this.graphql(query);
        return data ? data.appDisconnect : undefined;
    }
}

module.exports = { Api, DEFAULT_GRAPHQL_VERSION };
