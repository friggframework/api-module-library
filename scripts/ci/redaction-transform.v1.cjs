/**
 * aml.redaction.v1 — Binding C rev1 §4.4
 *
 * Replace secret-shaped values with stable placeholders of the form
 * [REDACTED:<kind>] that preserve JSON types (string) for replay.
 * Bind raw sha → this transform (id + file digest) → post-redaction sha.
 */
'use strict';

const TRANSFORM_ID = 'aml.redaction.v1';

const PLACEHOLDER = (kind) => `[REDACTED:${kind}]`;

const KEY_KIND = {
    access_token: 'access_token',
    refresh_token: 'refresh_token',
    client_secret: 'client_secret',
    client_id: 'client_id',
    token: 'token',
    authorization: 'authorization',
    api_key: 'api_key',
    apikey: 'api_key',
    password: 'password',
    code: 'authorization_code',
};

const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const BEARER_RE = /^Bearer\s+\S+/i;
const ALLOWED = /^(synthetic-[A-Za-z0-9_-]+|test-[A-Za-z0-9_-]+|\[REDACTED:[a-z0-9_]+\])$/;

function kindForKey(key) {
    if (!key) return null;
    const k = String(key).toLowerCase().replace(/-/g, '_');
    if (KEY_KIND[k]) return KEY_KIND[k];
    if (k.endsWith('access_token') || k === 'accesstoken') return 'access_token';
    if (k.endsWith('refresh_token')) return 'refresh_token';
    if (k.includes('client_secret')) return 'client_secret';
    if (k.includes('api_key') || k.includes('apikey')) return 'api_key';
    if (k === 'authorization') return 'authorization';
    return null;
}

function kindForValue(value) {
    if (typeof value !== 'string') return null;
    if (ALLOWED.test(value) || value.startsWith('[REDACTED:')) return null;
    if (JWT_RE.test(value)) return 'jwt';
    if (BEARER_RE.test(value)) return 'authorization';
    return null;
}

function redactValue(value, key) {
    if (typeof value !== 'string') return { value, redacted: false, kind: null };
    if (ALLOWED.test(value) || value.startsWith('[REDACTED:')) {
        return { value, redacted: false, kind: null };
    }
    const kind = kindForKey(key) || kindForValue(value);
    if (!kind) return { value, redacted: false, kind: null };
    return { value: PLACEHOLDER(kind), redacted: true, kind };
}

function redactDeep(node, key, acc) {
    if (Array.isArray(node)) {
        return node.map((item, i) => redactDeep(item, key, acc));
    }
    if (node && typeof node === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(node)) {
            out[k] = redactDeep(v, k, acc);
        }
        return out;
    }
    const result = redactValue(node, key);
    if (result.redacted) acc.push({ key, kind: result.kind });
    return result.value;
}

function applyRedaction(obj) {
    const replacements = [];
    const redacted = redactDeep(obj, null, replacements);
    return { redacted, replacements, transformId: TRANSFORM_ID };
}

module.exports = {
    TRANSFORM_ID,
    PLACEHOLDER,
    ALLOWED,
    JWT_RE,
    BEARER_RE,
    kindForKey,
    kindForValue,
    redactValue,
    applyRedaction,
};
