const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * ModMed Certified FHIR R4 (SMART on FHIR) API client.
 *
 * Auth: OAuth 2.0 authorization_code (+ refresh_token) with SMART App Launch.
 *   Authorize: https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/auth
 *   Token:     https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/token
 *   FHIR base (`aud`): practice-specific URL from the ModMed directory
 *     (default demonstration: https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4)
 *
 * Official docs:
 *   https://portal.api.modmed.com/reference/authentication-2
 *   https://portal.api.modmed.com/llms.txt (Certified API section)
 *   https://www.modmed.com/wp-content/uploads/2024/07/MMI-Certified-FHIR-API-Documentation-July-2024.pdf
 *
 * The curated contract in ./modmed.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Note: The EMA Proprietary FHIR v2 API (firm-scoped /ema/fhir/v2, password or
 * client_credentials + x-api-key) is a separate surface and is not wired here.
 * Billing resources such as ChargeItem / Invoice / PaymentReconciliation live
 * on that proprietary API — see open questions in the module PR.
 */

const DEFAULT_AUTHORIZE_URI =
    'https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/auth';
const DEFAULT_TOKEN_URI =
    'https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/token';
const DEFAULT_FHIR_BASE =
    'https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4';
const DEFAULT_SCOPE =
    'openid fhirUser offline_access launch/patient patient/*.read user/*.read user/*.write';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.MODMED_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.MODMED_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            process.env.MODMED_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/modmed`
                : null);

        this.scope =
            this.scope ||
            get(params, 'scope', null) ||
            process.env.MODMED_SCOPE ||
            DEFAULT_SCOPE;

        this.tokenUri = get(params, 'tokenUri', null) || DEFAULT_TOKEN_URI;
        this.authorizationUri =
            get(params, 'authorizationUri', null) || DEFAULT_AUTHORIZE_URI;

        // Practice FHIR R4 base (= OAuth `aud`). Alias: tenant (persisted).
        const fhirBase =
            get(params, 'fhir_base', null) ||
            get(params, 'tenant', null) ||
            process.env.MODMED_FHIR_BASE ||
            DEFAULT_FHIR_BASE;
        this.setFhirBase(fhirBase);

        this.fhirUser = get(params, 'fhirUser', null);

        this.URLs = {
            metadata: '/metadata',
            patient: '/Patient',
            patientById: (id) => `/Patient/${id}`,
            practitioner: '/Practitioner',
            practitionerById: (id) => `/Practitioner/${id}`,
            practitionerRole: '/PractitionerRole',
            practitionerRoleById: (id) => `/PractitionerRole/${id}`,
            location: '/Location',
            locationById: (id) => `/Location/${id}`,
            encounter: '/Encounter',
            encounterById: (id) => `/Encounter/${id}`,
            coverage: '/Coverage',
            coverageById: (id) => `/Coverage/${id}`,
            organization: '/Organization',
            organizationById: (id) => `/Organization/${id}`,
        };
    }

    /**
     * Set the practice FHIR R4 base URL (also used as OAuth `aud`).
     * Accepts either a full base URL or a legacy "tenant" alias.
     */
    setFhirBase(fhirBase) {
        const base = String(fhirBase || DEFAULT_FHIR_BASE).replace(/\/$/, '');
        this.fhir_base = base;
        this.tenant = base; // persisted credential alias used by the ported definition
        this.baseUrl = base;
        this.baseURL = base;
        this.audience = base;
    }

    /** @deprecated Prefer setFhirBase — kept for credential restore of `tenant`. */
    setTenant(tenant) {
        this.setFhirBase(tenant);
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || '',
            aud: this.baseUrl,
        });
        if (this.state) {
            params.append('state', this.state);
        }
        return `${this.authorizationUri}?${params.toString()}`;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'ModMed FHIR Authentication',
                    type: 'object',
                    required: ['fhir_base'],
                    properties: {
                        fhir_base: {
                            type: 'string',
                            title: 'Practice FHIR Base URL',
                            default: DEFAULT_FHIR_BASE,
                            description:
                                'Customer FHIR R4 base from the ModMed directory (OAuth aud). Demonstration: https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4',
                        },
                    },
                },
                uiSchema: {
                    fhir_base: {
                        'ui:help':
                            'Paste the practice FHIR R4 base URL. It is sent as the OAuth aud parameter and used as the API base.',
                        'ui:placeholder': DEFAULT_FHIR_BASE,
                    },
                },
            },
        };
    }

    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);

        const options = {
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            url: this.tokenUri,
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        if (response.fhirUser) {
            this.fhirUser = response.fhirUser;
        }
        return response;
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    _fhirHeaders(extra = {}) {
        return {
            Accept: 'application/fhir+json',
            ...extra,
        };
    }

    /**
     * Parse FHIR JSON even when Content-Type is application/fhir+json
     * (parent Requester only auto-parses application/json).
     */
    async parsedBody(resp) {
        const contentType = resp.headers.get('Content-Type') || '';
        if (
            contentType.match(/^application\/fhir\+json/) ||
            contentType.match(/^application\/json/) ||
            contentType.match(/^application\/vnd\.api\+json/)
        ) {
            return resp.json();
        }
        return resp.text();
    }

    // ---- Identity / metadata ------------------------------------------------

    /**
     * Fetch the server CapabilityStatement.
     * GET {base}/metadata
     * Docs: https://portal.api.modmed.com/reference/get_metadata
     */
    async getMetadata() {
        return this._get({
            url: this.baseUrl + this.URLs.metadata,
            headers: this._fhirHeaders(),
        });
    }

    /**
     * Resolve the logged-in FHIR user (Practitioner or Patient) via the
     * `fhirUser` claim returned on the token when the `fhirUser` scope is
     * granted. Falls back to the first Practitioner search result when the
     * claim is absent (e.g. bulk-style tokens).
     *
     * There is no documented Practitioner/$current operation on the Certified
     * API; this method is the module's identity helper for Frigg auth.
     */
    async getCurrentUser() {
        if (this.fhirUser) {
            const url = String(this.fhirUser).startsWith('http')
                ? String(this.fhirUser)
                : `${this.baseUrl}/${String(this.fhirUser).replace(/^\//, '')}`;
            return this._get({
                url,
                headers: this._fhirHeaders(),
            });
        }

        const bundle = await this.listPractitioners({ _count: 1 });
        const first = bundle?.entry?.[0]?.resource;
        if (first) return first;
        throw new Error(
            'ModMed: cannot resolve current user — no fhirUser claim and Practitioner search returned no entries.'
        );
    }

    // ---- Practitioner -------------------------------------------------------

    /** GET /Practitioner — https://portal.api.modmed.com/reference/get_practitioner */
    async listPractitioners(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.practitioner,
            query: params,
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Practitioner/{id} */
    async getPractitioner(practitionerId) {
        return this._get({
            url: this.baseUrl + this.URLs.practitionerById(practitionerId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- PractitionerRole ---------------------------------------------------

    /** GET /PractitionerRole */
    async listPractitionerRoles(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.practitionerRole,
            query: params,
            headers: this._fhirHeaders(),
        });
    }

    /** GET /PractitionerRole/{id} */
    async getPractitionerRole(practitionerRoleId) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.practitionerRoleById(practitionerRoleId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- Location -----------------------------------------------------------

    /** GET /Location — https://portal.api.modmed.com/reference/get_location */
    async listLocations(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.location,
            query: params,
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Location/{id} */
    async getLocation(locationId) {
        return this._get({
            url: this.baseUrl + this.URLs.locationById(locationId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- Patient ------------------------------------------------------------

    /**
     * GET /Patient
     * Docs: https://portal.api.modmed.com/reference/get_patient
     * Optional FHIR search params (e.g. _count, name, identifier, birthdate).
     */
    async listPatients(params = {}) {
        const { _count = 50, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.patient,
            query: { _count, ...filters },
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Patient/{id} */
    async getPatient(patientId) {
        return this._get({
            url: this.baseUrl + this.URLs.patientById(patientId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- Encounter ----------------------------------------------------------

    /** GET /Encounter — https://portal.api.modmed.com/reference/get_encounter */
    async listEncounters(params = {}) {
        const { _count = 50, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.encounter,
            query: { _count, ...filters },
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Encounter/{id} */
    async getEncounter(encounterId) {
        return this._get({
            url: this.baseUrl + this.URLs.encounterById(encounterId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- Coverage -----------------------------------------------------------

    /** GET /Coverage — https://portal.api.modmed.com/reference/get_coverage */
    async listCoverages(params = {}) {
        const { _count = 50, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.coverage,
            query: { _count, ...filters },
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Coverage/{id} */
    async getCoverage(coverageId) {
        return this._get({
            url: this.baseUrl + this.URLs.coverageById(coverageId),
            headers: this._fhirHeaders(),
        });
    }

    // ---- Organization -------------------------------------------------------

    /** GET /Organization — https://portal.api.modmed.com/reference/get_organization */
    async listOrganizations(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.organization,
            query: params,
            headers: this._fhirHeaders(),
        });
    }

    /** GET /Organization/{id} */
    async getOrganization(organizationId) {
        return this._get({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
            headers: this._fhirHeaders(),
        });
    }
}

module.exports = { Api };
