const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Digitail Public API client.
 *
 * Digitail is a veterinary practice management system (PIMS). Official auth is
 * OAuth 2.0 Authorization Code Grant with PKCE (not a static API key).
 *
 *   Authorize: {oauthHost}/oauth/authorize
 *   Token:     POST {oauthHost}/oauth/token  (application/x-www-form-urlencoded)
 *   API:       {apiBase}  (default production https://vet.digitail.io/api/v1)
 *
 * Authenticated requests send `Authorization: Bearer <access_token>`.
 * Multi-clinic: optional `X-ClinicId` header selects clinic context.
 *
 * Docs: https://documentation.digitail.io/
 * Auth: https://documentation.digitail.io/6-ex-authentication
 * Access: https://documentation.digitail.io/getting-access
 *
 * Ported from a Left Hook-owned Digitail module (generic Api/definition only);
 * endpoints and hosts below are verified against Digitail's official docs.
 * The source used a guessed `api.digitail.io` base and API-key-only auth —
 * those are incorrect per vendor documentation and are not carried forward.
 */

const DEFAULT_API_BASE = 'https://vet.digitail.io/api/v1';
const DEFAULT_OAUTH_HOST = 'https://vet.digitail.io';

/** URL-unreserved delimiter used to append an encrypted PKCE verifier to state. */
const STATE_VERIFIER_DELIMITER = '~';

function base64Url(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function generateCodeVerifier() {
    // Digitail: 43–128 chars from [A-Za-z0-9-._~]
    return base64Url(crypto.randomBytes(32));
}

function challengeFromVerifier(verifier) {
    return base64Url(crypto.createHash('sha256').update(verifier).digest());
}

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            process.env.DIGITAIL_API_BASE_URL ||
            DEFAULT_API_BASE;

        this.oauthHost = (
            get(params, 'oauthHost', null) ||
            process.env.DIGITAIL_OAUTH_HOST ||
            DEFAULT_OAUTH_HOST
        ).replace(/\/$/, '');

        this.tokenUri = `${this.oauthHost}/oauth/token`;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.clinicId =
            get(params, 'clinicId', null) ||
            get(params, 'clinic_id', null) ||
            process.env.DIGITAIL_CLINIC_ID ||
            null;

        // PKCE verifier for the in-flight authorization (also recoverable from state).
        this.code_verifier = get(params, 'code_verifier', null);

        this.URLs = {
            authMe: '/auth/me',
            clinics: '/clinics',
            petParents: '/pet-parents',
            petParent: (id) => `/pet-parents/${id}`,
            pets: '/pets',
            pet: (id) => `/pets/${id}`,
            appointments: '/appointments',
            appointment: (id) => `/appointments/${id}`,
            invoices: '/invoices',
            invoice: (id) => `/invoices/${id}`,
            sale: (id) => `/sales/${id}`,
            records: '/records',
        };

        this._rebuildAuthorizationUri();
    }

    _rebuildAuthorizationUri({ codeChallenge, state } = {}) {
        const challenge =
            codeChallenge ||
            (this.code_verifier
                ? challengeFromVerifier(this.code_verifier)
                : null);
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            code_challenge_method: 'S256',
        });
        if (challenge) params.set('code_challenge', challenge);
        if (state || this.state) params.set('state', state || this.state);
        this.authorizationUri = `${this.oauthHost}/oauth/authorize?${params.toString()}`;
        return this.authorizationUri;
    }

    /**
     * Start an OAuth authorization with a fresh PKCE pair.
     * Encrypts the code_verifier into `state` so the token exchange can recover it.
     */
    getAuthorizationUri(callerState) {
        this.code_verifier = generateCodeVerifier();
        const challenge = challengeFromVerifier(this.code_verifier);
        const encoded = this._encryptVerifier(this.code_verifier);
        const state = callerState
            ? `${callerState}${STATE_VERIFIER_DELIMITER}${encoded}`
            : encoded;
        return this._rebuildAuthorizationUri({ codeChallenge: challenge, state });
    }

    getAuthUri() {
        return this.getAuthorizationUri(this.state);
    }

    restoreVerifierFromState(state) {
        if (!state) return null;
        const at = String(state).lastIndexOf(STATE_VERIFIER_DELIMITER);
        const encrypted = at === -1 ? state : String(state).slice(at + 1);
        try {
            const verifier = this._decryptVerifier(encrypted);
            this.code_verifier = verifier;
            return verifier;
        } catch (e) {
            return null;
        }
    }

    _encryptVerifier(verifier) {
        const secret = this.client_secret || 'digitail-pkce';
        const key = crypto.createHash('sha256').update(secret).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(verifier, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
    }

    _decryptVerifier(encryptedState) {
        const [ivB64, encB64, tagB64] = String(encryptedState).split('.');
        if (!ivB64 || !encB64 || !tagB64) {
            throw new Error('Digitail: malformed PKCE state');
        }
        const secret = this.client_secret || 'digitail-pkce';
        const key = crypto.createHash('sha256').update(secret).digest();
        const iv = Buffer.from(ivB64, 'base64url');
        const encryptedBuf = Buffer.from(encB64, 'base64url');
        const tag = Buffer.from(tagB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
            decipher.update(encryptedBuf),
            decipher.final(),
        ]).toString('utf8');
    }

    setClinicId(clinicId) {
        this.clinicId = clinicId || null;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.clinicId) {
            next['X-ClinicId'] = String(this.clinicId);
        }
        if (!next.Accept) {
            next.Accept = 'application/json';
        }
        return next;
    }

    /**
     * Digitail token endpoint expects application/x-www-form-urlencoded and PKCE.
     * Docs: https://documentation.digitail.io/6-ex-authentication
     */
    async getTokenFromCode(code, extras = {}) {
        delete this.access_token;
        const state = extras.state || extras.data?.state;
        const verifier =
            extras.code_verifier ||
            extras.data?.code_verifier ||
            this.code_verifier ||
            (state ? this.restoreVerifierFromState(state) : null);
        if (!verifier) {
            throw new Error(
                'Digitail: code_verifier is required for PKCE token exchange'
            );
        }
        this.code_verifier = verifier;

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.client_id,
            client_secret: this.client_secret,
            redirect_uri: this.redirect_uri,
            code_verifier: verifier,
            code: String(code),
        });
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: body.toString(),
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh tokens. Digitail rotates both access and refresh tokens (single-use refresh).
     * PKCE is not required on refresh.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshTokenObject.refresh_token,
            client_id: this.client_id,
            client_secret: this.client_secret,
        });
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: body.toString(),
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // ---- Query helpers -----------------------------------------------------

    /**
     * Build a query string supporting Digitail filter[…] keys and array values
     * (repeated keys). Nested filter objects flatten to filter[key]=value.
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        const append = (key, value) => {
            if (value === undefined || value === null) return;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else if (typeof value === 'object') {
                for (const [k, v] of Object.entries(value)) {
                    append(`${key}[${k}]`, v);
                }
            } else {
                usp.append(key, String(value));
            }
        };
        for (const [key, value] of Object.entries(params || {})) {
            append(key, value);
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...extra,
        };
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Get the logged-in user (vet) and optional clinic/employee includes.
     * GET /auth/me
     * Docs: https://documentation.digitail.io/get-the-logged-in-user-vet
     */
    async getAuthMe(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.authMe + this._buildQuery(params),
        });
    }

    // ---- Clinics -----------------------------------------------------------

    /**
     * List clinics (optionally filtered by ids / admin / group).
     * GET /clinics
     * Docs: https://documentation.digitail.io/get-clinics-list-by-ids
     */
    async listClinics(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.clinics + this._buildQuery(params),
        });
    }

    // ---- Pet parents (clients / owners) ------------------------------------

    /**
     * List pet parents.
     * GET /pet-parents
     * Docs: https://documentation.digitail.io/list-all-petparents
     */
    async listPetParents(params = {}) {
        return this._get({
            url:
                this.baseUrl + this.URLs.petParents + this._buildQuery(params),
        });
    }

    /**
     * Retrieve a pet parent.
     * GET /pet-parents/{id}
     * Docs: https://documentation.digitail.io/retrieve-a-petparent
     */
    async getPetParent(petParentId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.petParent(petParentId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a pet parent.
     * POST /pet-parents
     * Docs: https://documentation.digitail.io/create-a-petparent
     */
    async createPetParent(data) {
        return this._post({
            url: this.baseUrl + this.URLs.petParents,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a pet parent.
     * PATCH /pet-parents/{id}
     * Docs: https://documentation.digitail.io/update-a-petparent
     */
    async updatePetParent(petParentId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.petParent(petParentId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Pets (patients) ---------------------------------------------------

    /**
     * List pets. filter[clinic_id] is required by the vendor.
     * GET /pets
     * Docs: https://documentation.digitail.io/list-all-pets
     */
    async listPets(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.pets + this._buildQuery(params),
        });
    }

    /**
     * Retrieve a pet.
     * GET /pets/{id}
     * Docs: https://documentation.digitail.io/retrieve-a-pet
     */
    async getPet(petId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.pet(petId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a pet.
     * POST /pets — vendor docs specify multipart/form-data (avatar binary).
     * Non-file fields are sent as multipart parts; pass `avatar` as a Blob/Buffer
     * when uploading a profile picture.
     * Docs: https://documentation.digitail.io/create-a-pet
     */
    async createPet(data = {}) {
        const form = new FormData();
        for (const [key, value] of Object.entries(data || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) form.append(key, String(v));
            } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
                form.append(key, value);
            } else if (Buffer.isBuffer(value)) {
                form.append(
                    key,
                    new Blob([value]),
                    data.avatarFilename || 'avatar.bin'
                );
            } else {
                form.append(key, String(value));
            }
        }
        return this._post({
            url: this.baseUrl + this.URLs.pets,
            // Let fetch set multipart boundary — do not force Content-Type.
            headers: { Accept: 'application/json' },
            body: form,
        }, false);
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * List appointments.
     * GET /appointments
     * Docs: https://documentation.digitail.io/get-all-appointments
     */
    async listAppointments(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.appointments +
                this._buildQuery(params),
        });
    }

    /**
     * Retrieve an appointment.
     * GET /appointments/{id}
     * Docs: https://documentation.digitail.io/retrieve-an-appointment
     */
    async getAppointment(appointmentId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.appointment(appointmentId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create an appointment.
     * POST /appointments
     * Docs: https://documentation.digitail.io/create-an-appointment
     */
    async createAppointment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.appointments,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Invoices / sales --------------------------------------------------

    /**
     * List invoices.
     * GET /invoices
     * Docs: https://documentation.digitail.io/list-all-invoices
     */
    async listInvoices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.invoices + this._buildQuery(params),
        });
    }

    /**
     * Retrieve an invoice.
     * GET /invoices/{id}
     * Docs: https://documentation.digitail.io/retrieve-an-invoice
     */
    async getInvoice(invoiceId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.invoice(invoiceId) +
                this._buildQuery(params),
        });
    }

    /**
     * Retrieve a sale (include=payments,invoice,… for payment details).
     * GET /sales/{id}
     * Docs: https://documentation.digitail.io/retrieve-a-sale
     *
     * There is no documented standalone list/create payments collection;
     * payments are nested on sales.
     */
    async getSale(saleId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.sale(saleId) +
                this._buildQuery(params),
        });
    }

    // ---- Medical records ---------------------------------------------------

    /**
     * List medical records (file cases).
     * GET /records
     * Docs: https://documentation.digitail.io/list-all-records
     */
    async listRecords(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.records + this._buildQuery(params),
        });
    }
}

module.exports = {
    Api,
    DEFAULT_API_BASE,
    DEFAULT_OAUTH_HOST,
    generateCodeVerifier,
    challengeFromVerifier,
};
