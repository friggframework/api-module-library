import { OAuth2Requester } from '@friggframework/core';

interface DocuSignConstructorParams {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    scope: string;
    environment: 'dev' | 'prod'; // Added environment
    state?: string;
    access_token?: string;
    refresh_token?: string;
    base_url?: string; // User override OR stored base_uri from entity
    account_id?: string;
}

interface EnvelopeDefinition {
    // Define structure based on https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/create/
    emailSubject: string;
    documents: any[]; // Replace 'any' with a proper Document type
    recipients: any; // Replace 'any' with a proper Recipients type (signers, carbonCopies etc.)
    status: 'sent' | 'created'; // Typically 'sent' to send immediately, 'created' for draft
    [key: string]: any; // Allow other properties
}

interface VoidEnvelopeRequest {
    status: 'voided';
    voidedReason: string;
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    [key: string]: any;
}

export class Api extends OAuth2Requester {
    protected accountId?: string;
    protected baseUriHost: string; // Renamed from baseUrl - stores the host part
    protected environment: 'dev' | 'prod';
    public authorizationUri: string;
    public tokenUri: string;
    protected authHost: string;

    declare public client_id: string;
    declare public client_secret: string;
    declare public redirect_uri: string;

    constructor(params: DocuSignConstructorParams) {
        super(params);
        this.environment = params.environment || 'dev';

        this.authHost = this.environment === 'prod'
            ? 'https://account.docusign.com'
            : 'https://account-d.docusign.com';


        let host = params.base_url;
        if (!host) {
            host = this.environment === 'prod'
                ? 'https://docusign.net'
                : 'https://demo.docusign.net';
        }
        this.baseUriHost = host;
        this.accountId = params.account_id;

        this.authorizationUri = `${this.authHost}/oauth/auth`;
        this.tokenUri = `${this.authHost}/oauth/token`;
    }

    setAccountId(accountId: string) {
        this.accountId = accountId;
    }

    private _getAccountApiBaseUrl(): string {
        if (!this.accountId) {
            throw new Error('DocuSign Account ID is required but not set.');
        }
        if (!this.baseUriHost) {
            throw new Error('DocuSign Base URI Host is required but not set.');
        }

        return `${this.baseUriHost}/restapi/v2.1/accounts/${this.accountId}`;
    }

    getAuthorizationUri(): string {
        const baseUri = `${this.authHost}/oauth/auth`;
        const params = new URLSearchParams();

        params.append('response_type', 'code');
        params.append('client_id', this.client_id);
        params.append('redirect_uri', this.redirect_uri);
        params.append('scope', this.scope);
        if (this.state) {
            params.append('state', this.state);
        }

        // Note: Does not include PKCE parameters (code_challenge)
        // Consider adding if needed for enhanced security, requires generating code_verifier.

        return `${baseUri}?${params.toString()}`;
    }

    addJsonHeaders(options: any) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _get(options: any) {
        this.addJsonHeaders(options);
        return super._get(options);
    }

    async _post(options: any, stringify?: boolean) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options: any, stringify?: boolean) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    async _patch(options: any, stringify?: boolean) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options: any) {
        this.addJsonHeaders(options);
        return super._delete(options);
    }

    // Method to handle the OAuth token exchange (authorization code flow)
    async getTokenFromCode(code: string): Promise<TokenResponse> {
        const url = this.tokenUri;

        // Ensure 'this' is used for base class protected members
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.redirect_uri, // Explicit this
        }).toString();

        const clientCredentials = Buffer.from(
            `${this.client_id}:${this.client_secret}` // Explicit this
        ).toString('base64');

        const options = {
            url: url,
            headers: {
                Authorization: `Basic ${clientCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: options.headers,
                body: options.body,
            });

            const data = await response.json();

            if (!response.ok) {
                const errorPayload = data || { message: response.statusText };
                throw new Error(
                    `Token exchange failed with status ${response.status}: ${JSON.stringify(errorPayload)}`
                );
            }

            this.setTokens(data);

            return data as TokenResponse;
        } catch (error: any) {
            console.error('Error during token exchange:', error);
            throw new Error(`Token exchange request failed: ${error.message}`);
        }
    }

    /**
     * Retrieves the list of envelopes for the account.
     * DocuSign API: GET /envelopes
     * @param query Optional query parameters
     */
    async listEnvelopes(query?: Record<string, any>) {
        const baseUrl = this._getAccountApiBaseUrl();
        const options = {
            url: `${baseUrl}/envelopes`, // Append specific endpoint
            query: query || {},
        };
        return this._get(options);
    }

    /**
     * Retrieves the details of a specific envelope.
     * DocuSign API: GET /envelopes/{envelopeId}
     * @param envelopeId The ID of the envelope to retrieve.
     * @param query Optional query parameters
     */
    async getEnvelope(envelopeId: string, query?: Record<string, any>) {
        const baseUrl = this._getAccountApiBaseUrl();
        const options = {
            url: `${baseUrl}/envelopes/${envelopeId}`, // Append specific endpoint
            query: query || {},
        };
        return this._get(options);
    }

    /**
     * Creates a new envelope.
     * DocuSign API: POST /envelopes
     * @param definition The envelope definition
     */
    async createEnvelope(definition: EnvelopeDefinition) {
        const baseUrl = this._getAccountApiBaseUrl();
        const options = {
            url: `${baseUrl}/envelopes`, // Append specific endpoint
            body: definition,
        };
        return this._post(options);
    }

    /**
     * Voids a sent envelope that is still in process.
     * DocuSign API: PUT /envelopes/{envelopeId}
     * @param envelopeId The ID of the envelope to void.
     * @param reason The reason for voiding the envelope.
     */
    async voidEnvelope(envelopeId: string, reason: string) {
        const baseUrl = this._getAccountApiBaseUrl();
        const body: VoidEnvelopeRequest = {
            status: 'voided',
            voidedReason: reason,
        };
        const options = {
            url: `${baseUrl}/envelopes/${envelopeId}`, // Append specific endpoint
            body: body,
        };
        return this._put(options);
    }

    async getUserInfo() {
        const options = {
            url: `${this.authHost}/oauth/userinfo`,
        };
        this.addJsonHeaders(options);
        return super._get(options);
    }
} 