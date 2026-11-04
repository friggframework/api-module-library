const { ApiKeyRequester, ModuleConstants } = require('@friggframework/core');

/**
 * DonorPerfect Online (DPO) XML API client.
 *
 * Auth: API key only — no header auth. Every call is a form-encoded POST to
 *   <baseUrl>/xmlrequest.asp with `apikey=` appended in the body.
 * Base URL: https://www.donorperfect.net/prod (override with DONORPERFECT_BASE_URL).
 *
 * Official docs:
 *   https://www.softerware.com/doclib/dp/manuals/dpo_sup_manual_xml_api_documentation.pdf
 *   https://www.donorperfect.com/factsheets/api-access-feature/
 *
 * The manual samples use GET query strings; POST is required for larger
 * payloads (GET hits HTTP 414 past ~8KB). Failures often arrive as HTTP 200
 * with a `success='false'` field in the XML body.
 */

const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_BASE_URL = 'https://www.donorperfect.net/prod';
const ENDPOINT_PATH = '/xmlrequest.asp';

const AUTH_PROBE_ACTION = 'select top 1 donor_id from dp';
const SAVE_DONOR_ACTION = 'dp_savedonor';
const SAVE_GIFT_ACTION = 'dp_savegift';
const LIST_GIFTS_ACTION = 'dp_gifts';
// @user_id is capped at 20 chars (vendor manual).
const AUDIT_USER_ID = 'Frigg';

// DP rejects any dp_savedonor call (create or update) that omits one of these
// (except @donor_rcpt_type), sends a NULL @last_name, or sends @nomail other
// than 'Y'/'N'. Field list from the XML API manual (dp_savedonor) plus
// donor_rcpt_type observed on live accounts.
const DONOR_SAVE_PARAMS = [
    'donor_id',
    'first_name',
    'last_name',
    'middle_name',
    'suffix',
    'title',
    'salutation',
    'prof_title',
    'opt_line',
    'address',
    'address2',
    'city',
    'state',
    'zip',
    'country',
    'address_type',
    'home_phone',
    'business_phone',
    'fax_phone',
    'mobile_phone',
    'email',
    'org_rec',
    'donor_type',
    'nomail',
    'nomail_reason',
    'narrative',
    'donor_rcpt_type',
];

// dp_savegift required named params from the vendor manual. Optional params
// fall back to DP defaults when omitted (e.g. @receipt_delivery_g → 'L').
const GIFT_SAVE_PARAMS = [
    'gift_id',
    'donor_id',
    'record_type',
    'gift_date',
    'amount',
    'gl_code',
    'solicit_code',
    'sub_solicit_code',
    'campaign',
    'gift_type',
    'split_gift',
    'pledge_payment',
    'reference',
    'memory_honor',
    'gfname',
    'glname',
    'fmv',
    'batch_no',
    'gift_narrative',
    'ty_letter_no',
    'glink',
    'plink',
    'nocalc',
    'receipt',
    'old_amount',
    'receipt_delivery_g',
];
const GIFT_OPTIONAL_PARAMS = ['campaign', 'receipt_delivery_g'];

// Defaults keep new gifts out of DPO's receipting queue unless the caller
// overrides them. Not sent: @gift_aid_*, @currency (account default),
// @acknowledgepref (Canadian systems).
const GIFT_DEFAULTS = {
    record_type: 'G',
    split_gift: 'N',
    pledge_payment: 'N',
    nocalc: 'N',
    receipt: 'N',
    receipt_delivery_g: 'N',
    batch_no: 0,
};

// DP stores a time suffix when one is sent; only MM/DD/YYYY is supported.
const GIFT_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

// DP caps every dynamic SELECT at 500 rows.
const ROW_RETRIEVAL_LIMIT = 500;

// DP stores phones free-form ('(610) 444-6555', '913-222-9999'), so both sides
// are compared on their last 10 digits.
const PHONE_MATCH_DIGITS = 10;

const RETRY_BACKOFF_SECONDS = [1, 3, 10];

function digitsOnlyColumn(column) {
    const stripped = ['(', ')', '-', ' ', '.', '+'].reduce(
        (sql, char) => `replace(${sql},'${char}','')`,
        column
    );
    return `right(${stripped},${PHONE_MATCH_DIGITS})`;
}

function phoneMatchKey(phone) {
    return String(phone ?? '')
        .replace(/\D/g, '')
        .slice(-PHONE_MATCH_DIGITS);
}

function escapeSqlValue(value) {
    return String(value).replace(/'/g, "''");
}

function serializeParamValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    return `'${escapeSqlValue(value)}'`;
}

function serializeParams(params) {
    return Object.entries(params)
        .filter(([key]) => key !== 'user_id')
        .map(([key, value]) => `@${key}=${serializeParamValue(value)}`)
        .concat(`@user_id='${escapeSqlValue(AUDIT_USER_ID)}'`)
        .join(',');
}

// &amp; is decoded last so an escaped '&amp;#39;' stays the literal '&#39;'.
function decodeXmlEntities(value) {
    return String(value)
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        )
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

// The live API single-quotes attributes; the manual's samples double-quote.
function parseAttributes(tag) {
    const attrs = {};
    const attrRe = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = attrRe.exec(tag)) !== null) {
        attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3]);
    }
    return attrs;
}

function parseFieldTags(xml) {
    const fields = [];
    const fieldRe = /<field\b[^>]*\/?>/g;
    let match;
    while ((match = fieldRe.exec(xml)) !== null) {
        fields.push(parseAttributes(match[0]));
    }
    return fields;
}

/**
 * Parse a DPO `<result>` XML body.
 * Returns { success, reason, records, recordValues }.
 * `records` maps named fields per `<record>`; `recordValues` keeps every value
 * in order because `dp_savedonor` answers with an unnamed field
 * (`<field name='' value='147'/>`), sometimes without a `<record>` wrapper.
 */
function parseResultXml(xml) {
    const text = String(xml);
    const records = [];
    const recordValues = [];
    const recordRe = /<record\b[^>]*>([\s\S]*?)<\/record\s*>/g;
    let recordMatch;
    while ((recordMatch = recordRe.exec(text)) !== null) {
        const row = {};
        const values = [];
        for (const field of parseFieldTags(recordMatch[1])) {
            const key = field.name || field.id;
            if (key) row[key] = field.value;
            if (field.value !== undefined) values.push(field.value);
        }
        records.push(row);
        recordValues.push(values);
    }

    const topLevelFields = parseFieldTags(text);
    const successField = topLevelFields.find((f) => f.name === 'success');
    if (records.length === 0) {
        const values = topLevelFields
            .map((f) => f.value)
            .filter((v) => v !== undefined);
        if (values.length > 0) recordValues.push(values);
    }
    return {
        success: successField ? successField.value !== 'false' : true,
        reason: successField?.reason || null,
        records,
        recordValues,
    };
}

function normalizeNomail(value) {
    const flag = String(value ?? '').toUpperCase();
    return flag === 'Y' ? 'Y' : 'N';
}

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            params.baseUrl ||
            process.env.DONORPERFECT_BASE_URL ||
            DEFAULT_BASE_URL;

        if (params.api_key) {
            this.setApiKey(params.api_key);
        }
    }

    // DP accepts no header auth; the key travels only in the form body.
    async addAuthHeaders(headers) {
        return headers;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'DonorPerfect API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'In DonorPerfect, go to Settings > User Management, add a dedicated user for this integration, open it, click API Self Service, then Generate New Key.',
                    },
                },
            },
        };
    }

    // Stored keys already contain URL-encoded characters (%2f, %2b), and the
    // manual says the key "must not be URLencoded": it is sent byte-identical.
    get rawApiKey() {
        return this.api_key || null;
    }

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Bypasses the framework requester, which would re-encode the stored key.
    // Errors carry fixed messages only: a fetch error would echo the body,
    // and the body holds the key.
    async _fetchText(url, body, attempt = 0) {
        const controller = new AbortController();
        const handle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const retry = async () => {
            clearTimeout(handle);
            await this._sleep(RETRY_BACKOFF_SECONDS[attempt] * 1000);
            return this._fetchText(url, body, attempt + 1);
        };
        const canRetry = attempt < RETRY_BACKOFF_SECONDS.length;
        try {
            let response;
            try {
                response = await this.fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body,
                    signal: controller.signal,
                });
            } catch (error) {
                // A timeout is not retried: each retry would wait another
                // full timeout on an already slow endpoint.
                if (error?.code === 'ECONNRESET' && canRetry) return retry();
                const isTimeout =
                    error?.name === 'AbortError' || error?.type === 'aborted';
                const fetchError = new Error(
                    isTimeout
                        ? `DonorPerfect request timed out (${REQUEST_TIMEOUT_MS}ms)`
                        : 'DonorPerfect request failed'
                );
                fetchError.isTimeout = isTimeout;
                fetchError.statusCode = 0;
                throw fetchError;
            }

            const { status } = response;
            if ((status === 429 || status >= 500) && canRetry) return retry();
            if (status >= 400) {
                const fetchError = new Error(
                    `DonorPerfect request failed (HTTP ${status})`
                );
                fetchError.statusCode = status;
                throw fetchError;
            }
            return await response.text();
        } finally {
            clearTimeout(handle);
        }
    }

    _buildBody(action, params) {
        let body = `action=${encodeURIComponent(action)}`;
        if (params !== undefined) {
            body += `&params=${encodeURIComponent(params)}`;
        }
        return `${body}&apikey=${this.rawApiKey || ''}`;
    }

    /**
     * Issue one XML API call. An empty or malformed body throws instead of
     * reading as "no match" (that would create duplicate donors on retry).
     * `retry: false` is for creating writes: a gateway 5xx can follow a
     * committed save, and a repeat would store a second record.
     */
    async _requestXml(action, { params, retry = true } = {}) {
        const text = (
            await this._fetchText(
                `${this.baseUrl}${ENDPOINT_PATH}`,
                this._buildBody(action, params),
                retry ? 0 : RETRY_BACKOFF_SECONDS.length
            )
        ).trim();
        if (!text) {
            throw new Error('DonorPerfect returned an empty response body');
        }
        if (
            !/<result\b[\s\S]*<\/result\s*>/.test(text) &&
            !/^<result\s*\/>/.test(text)
        ) {
            throw new Error('DonorPerfect returned a malformed XML response');
        }
        return parseResultXml(text);
    }

    /** Auth probe — `select top 1 donor_id from dp`. */
    async testAuthRequest() {
        return this._requestXml(AUTH_PROBE_ACTION);
    }

    /**
     * List donors via dynamic SELECT (vendor manual § SELECT Statements).
     * Paginate with `afterDonorId` (exclusive lower bound on donor_id).
     * Capped at DP's 500-row SELECT limit per page.
     */
    async listDonors({ top = ROW_RETRIEVAL_LIMIT, afterDonorId } = {}) {
        const limit = Math.min(
            Math.max(Number(top) || ROW_RETRIEVAL_LIMIT, 1),
            ROW_RETRIEVAL_LIMIT
        );
        const bound =
            afterDonorId === undefined || afterDonorId === null
                ? ''
                : ` where donor_id>${Number(afterDonorId)}`;
        const action = `select top ${limit} donor_id, first_name, last_name, email, org_rec, donor_type from dp${bound} order by donor_id`;
        const parsed = await this._requestXml(action);
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, donors: [] };
        }
        return {
            success: true,
            donors: parsed.records.map((record) => ({
                donor_id: Number(record.donor_id) || record.donor_id,
                first_name: record.first_name,
                last_name: record.last_name,
                email: record.email,
                org_rec: record.org_rec,
                donor_type: record.donor_type,
            })),
        };
    }

    // Email equality is case-insensitive under DP's SQL Server collation.
    async findDonorByEmail(email) {
        const value = email == null ? '' : String(email).trim();
        const action = `select donor_id, first_name, last_name from dp where email='${escapeSqlValue(value)}'`;
        return this._lookupResult(await this._requestXml(action));
    }

    async findDonorByPhone(homePhone, mobilePhone) {
        const keys = [
            ...new Set([phoneMatchKey(homePhone), phoneMatchKey(mobilePhone)]),
        ].filter(Boolean);
        if (keys.length === 0) {
            return { success: true, donors: [] };
        }
        const clauses = keys.map(
            (key) =>
                `${digitsOnlyColumn('home_phone')}='${key}' or ${digitsOnlyColumn('mobile_phone')}='${key}'`
        );
        const action = `select donor_id, first_name, last_name from dp where ${clauses.join(' or ')}`;
        return this._lookupResult(await this._requestXml(action));
    }

    _lookupResult(parsed) {
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, donors: [] };
        }
        return {
            success: true,
            donors: parsed.records.map((record) => ({
                donor_id: Number(record.donor_id) || record.donor_id,
                first_name: record.first_name,
                last_name: record.last_name,
            })),
        };
    }

    /**
     * Resolve DPCODES values for a code-list field (STATE, COUNTRY, GIFT_TYPE, …).
     * Save procedures do not validate codes, so callers resolve here first.
     * Pages past DP's 500-row SELECT cap.
     */
    async getCodes(fieldName) {
        const field = escapeSqlValue(fieldName);
        const codes = [];
        let after = null;
        for (;;) {
            const bound =
                after === null ? '' : ` and code>'${escapeSqlValue(after)}'`;
            const parsed = await this._requestXml(
                `select code, description from dpcodes where field_name='${field}'${bound} order by code`
            );
            if (parsed.success === false) {
                return { success: false, reason: parsed.reason, codes: [] };
            }
            codes.push(
                ...parsed.records.map(({ code, description }) => ({
                    code,
                    description,
                }))
            );
            const last = parsed.records[parsed.records.length - 1]?.code;
            if (
                parsed.records.length < ROW_RETRIEVAL_LIMIT ||
                last === undefined ||
                last === after
            ) {
                return { success: true, codes };
            }
            after = last;
        }
    }

    // DP returns NULL columns as ''; they are read back as null.
    async getDonorById(donorId) {
        const id = Number(donorId);
        if (!Number.isInteger(id) || id <= 0) {
            return { success: false, reason: 'invalid donor id', donor: null };
        }
        const parsed = await this._requestXml(
            `select ${DONOR_SAVE_PARAMS.join(', ')} from dp where donor_id=${id}`
        );
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, donor: null };
        }
        const [row] = parsed.records;
        if (!row) return { success: true, donor: null };
        const donor = {};
        for (const name of DONOR_SAVE_PARAMS) {
            donor[name] =
                row[name] === undefined || row[name] === '' ? null : row[name];
        }
        return { success: true, donor };
    }

    /**
     * Create or update a donor via `dp_savedonor`.
     * `donorId` 0 creates and returns the new id; an existing id updates and
     * DP returns 0. Updates re-send the current row with only supplied fields
     * replaced so DP-only data survives. Not atomic (no concurrency token).
     */
    async saveDonor({ donorId = 0, values = {} } = {}) {
        const isCreate = Number(donorId) === 0;
        let base;
        if (isCreate) {
            base = Object.fromEntries(
                DONOR_SAVE_PARAMS.map((name) => [name, null])
            );
        } else {
            const current = await this.getDonorById(donorId);
            if (current.success === false) {
                return {
                    success: false,
                    reason: current.reason,
                    donorId: null,
                };
            }
            if (!current.donor) {
                return {
                    success: false,
                    notFound: true,
                    reason: 'donor not found',
                    donorId: null,
                };
            }
            base = current.donor;
        }
        const params = { ...base };
        for (const [key, value] of Object.entries(values)) {
            if (key === 'donor_id' || key === 'user_id') continue;
            params[key] = value;
        }
        params.donor_id = isCreate ? 0 : Number(donorId);
        params.last_name ??= '';
        params.nomail = normalizeNomail(params.nomail);

        const parsed = await this._requestXml(SAVE_DONOR_ACTION, {
            params: serializeParams(params),
            retry: !isCreate,
        });
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, donorId: null };
        }
        // A save without a returned value is malformed — never fabricate an id.
        const returnedValue = parsed.recordValues[0]?.[0];
        if (returnedValue === undefined || returnedValue === '') {
            return {
                success: false,
                reason: 'no donor id returned',
                donorId: null,
            };
        }
        const numericId = Number(returnedValue);
        return {
            success: true,
            donorId: Number.isFinite(numericId) ? numericId : returnedValue,
        };
    }

    /**
     * Create a gift via `dp_savegift` (create-only in this client).
     * DP replaces every supplied field on update, which would undo staff
     * edits — callers should create once and look up by reference.
     */
    async saveGift({ values = {} } = {}) {
        const donorId = Number(values.donor_id);
        if (!Number.isInteger(donorId) || donorId <= 0) {
            return { success: false, reason: 'invalid donor id', giftId: null };
        }
        if (!GIFT_DATE_PATTERN.test(String(values.gift_date ?? ''))) {
            return {
                success: false,
                reason: 'invalid gift date',
                giftId: null,
            };
        }
        const params = {
            ...Object.fromEntries(GIFT_SAVE_PARAMS.map((name) => [name, null])),
            ...GIFT_DEFAULTS,
        };
        for (const [key, value] of Object.entries(values)) {
            if (key === 'gift_id' || key === 'user_id') continue;
            params[key] = value;
        }
        params.gift_id = 0;
        params.donor_id = donorId;

        const parsed = await this._requestXml(SAVE_GIFT_ACTION, {
            params: serializeParams(params),
            retry: false,
        });
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, giftId: null };
        }
        const returnedValue = parsed.recordValues[0]?.[0];
        if (returnedValue === undefined || returnedValue === '') {
            return {
                success: false,
                reason: 'no gift id returned',
                giftId: null,
            };
        }
        const numericId = Number(returnedValue);
        return {
            success: true,
            giftId: Number.isFinite(numericId) ? numericId : returnedValue,
        };
    }

    /**
     * List gifts for a donor via the documented `dp_gifts` procedure
     * (`action=dp_gifts&params=<donor_id>`).
     */
    async listGiftsByDonorId(donorId) {
        const id = Number(donorId);
        if (!Number.isInteger(id) || id <= 0) {
            return { success: false, reason: 'invalid donor id', gifts: [] };
        }
        const parsed = await this._requestXml(LIST_GIFTS_ACTION, {
            params: String(id),
        });
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, gifts: [] };
        }
        return {
            success: true,
            gifts: parsed.records.map((record) => ({
                ...record,
                gift_id: Number(record.gift_id) || record.gift_id,
                donor_id: Number(record.donor_id) || record.donor_id || id,
                amount:
                    record.amount === undefined || record.amount === ''
                        ? null
                        : Number(record.amount),
                gift_date: record.gift_date || null,
                gift_type: record.gift_type || null,
                reference: record.reference || null,
                record_type: record.record_type || null,
            })),
        };
    }

    // A blank reference is never queried: it would match every gift that has
    // none, and the caller would link to an unrelated gift.
    async findGiftsByReference(reference) {
        const value = reference == null ? '' : String(reference).trim();
        if (value === '') return { success: true, gifts: [] };
        const parsed = await this._requestXml(
            `select gift_id, donor_id, amount from dpgift where reference='${escapeSqlValue(value)}'`
        );
        if (parsed.success === false) {
            return { success: false, reason: parsed.reason, gifts: [] };
        }
        return {
            success: true,
            gifts: parsed.records.map((record) => ({
                gift_id: Number(record.gift_id) || record.gift_id,
                donor_id: Number(record.donor_id) || record.donor_id,
                amount: Number(record.amount),
            })),
        };
    }
}

module.exports = {
    Api,
    AUDIT_USER_ID,
    DONOR_SAVE_PARAMS,
    GIFT_SAVE_PARAMS,
    GIFT_OPTIONAL_PARAMS,
    GIFT_DEFAULTS,
    DEFAULT_BASE_URL,
    ENDPOINT_PATH,
    ROW_RETRIEVAL_LIMIT,
    serializeParams,
    parseResultXml,
};
