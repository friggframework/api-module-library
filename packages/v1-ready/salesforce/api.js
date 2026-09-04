const { get, OAuth2Requester } = require('@friggframework/core');
const jsforce = require('jsforce');
const crypto = require('crypto');

class Api extends OAuth2Requester {
    // Separates the caller's state from the appended PKCE verifier. `~` is
    // unreserved per RFC 3986 (so it round-trips through the provider redirect
    // unescaped) and is not in the base64url alphabet, so it cannot appear
    // inside the encrypted verifier itself.
    static STATE_VERIFIER_DELIMITER = '~';

    constructor(params) {
        super(params);
        this.jsforce = jsforce;
        this.key = get(params, 'client_id', null);
        this.secret = get(params, 'client_secret', null);
        this.instanceUrl = get(params, 'instanceUrl', null);
        this.isSandbox = get(params, 'isSandbox', false);
        if (this.isSandbox) {
            this.loginUrl = 'https://test.salesforce.com';
        } else {
            this.loginUrl = 'https://login.salesforce.com';
        }
        this.oauth2 = new jsforce.OAuth2({
            clientId: this.client_id,
            clientSecret: this.client_secret,
            redirectUri: this.redirect_uri,
            loginUrl: this.loginUrl,
        });
        this.conn = new jsforce.Connection({
            oauth2: this.oauth2,
            accessToken: this.access_token,
            refreshToken: this.refresh_token,
            instanceUrl: this.instanceUrl,
        });
        this.conn.on('refresh', (accessToken, res) => {
            console.log(accessToken);
            this.refreshAccessToken(res).then(() => {
                console.log('Refreshed');
            });
        });
        this.conn.on('error', (error) => {
            console.log(error);
        });
    }

    getAuthorizationUri() {
        // Recreate oauth2 with a fresh PKCE verifier for this auth flow only.
        // We don't keep useVerifier: true on the long-lived instance because
        // jsforce would send the stale verifier on every token refresh, which
        // Salesforce rejects with "unexpected code verifier".
        this.oauth2 = new jsforce.OAuth2({
            clientId: this.client_id,
            clientSecret: this.client_secret,
            redirectUri: this.redirect_uri,
            loginUrl: this.loginUrl,
            useVerifier: true,
        });
        this.conn.oauth2 = this.oauth2;
        const url = this.oauth2.getAuthorizationUrl({ scope: this.scope });
        const verifier = this.oauth2.codeVerifier;
        const callerState = this.state || null;
        if (!verifier) {
            return callerState ? this._withState(url, callerState) : url;
        }
        // `state` is the caller's: Frigg hands the adopter's value to the
        // constructor and adopters route the OAuth callback with it. We need the
        // PKCE verifier back on the return leg too, so APPEND it behind a
        // delimiter rather than replacing what the caller asked for. Replacing
        // it left adopters unable to route their own callback.
        const encoded = this._encryptVerifier(verifier);
        return this._withState(
            url,
            callerState
                ? `${callerState}${Api.STATE_VERIFIER_DELIMITER}${encoded}`
                : encoded
        );
    }

    _withState(url, state) {
        const urlObj = new URL(url);
        urlObj.searchParams.set('state', state);
        return urlObj.toString();
    }

    restoreVerifierFromState(state) {
        // The encrypted verifier is the trailing segment. A state with no
        // delimiter is either an authorization that started before this change
        // or one where the caller supplied no state of their own — both carry
        // the verifier alone.
        const at = String(state).lastIndexOf(Api.STATE_VERIFIER_DELIMITER);
        const encrypted = at === -1 ? state : String(state).slice(at + 1);
        const verifier = this._decryptVerifier(encrypted);
        this.oauth2.codeVerifier = verifier;
        this.conn.oauth2.codeVerifier = verifier;
    }

    _encryptVerifier(verifier) {
        const key = crypto.createHash('sha256').update(this.client_secret).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(verifier, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
    }

    _decryptVerifier(encryptedState) {
        const [ivB64, encB64, tagB64] = encryptedState.split('.');
        const key = crypto.createHash('sha256').update(this.client_secret).digest();
        const iv = Buffer.from(ivB64, 'base64url');
        const encryptedBuf = Buffer.from(encB64, 'base64url');
        const tag = Buffer.from(tagB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf8');
    }

    resetToSandbox() {
        this.oauth2 = new jsforce.OAuth2({
            clientId: this.client_id,
            clientSecret: this.client_secret,
            redirectUri: this.redirect_uri,
            loginUrl: 'https://test.salesforce.com',
        });

        this.conn = new jsforce.Connection({
            oauth2: this.oauth2,
            accessToken: this.access_token,
            refreshToken: this.refresh_token,
            instanceUrl: this.instanceUrl,
        });
        this.isSandbox = true;
    }

    async getAccessToken(code) {
        try {
            await this.conn.authorize(code);
        } catch (e) {
            console.log('Error authing with the code. Trying to auth sandbox.', e?.message || e);
            throw new Error(
                `Error Authing with Code, try Sandbox. ${e?.message || JSON.stringify(e)}`
            );
        }
        const OAuthDetails = {
            access_token: this.conn.accessToken,
            refresh_token: this.conn.refreshToken,
            expiration: this.conn.expiration,
            instanceUrl: this.conn.instanceUrl,
        };
        // Set the instance URL because I'm not sure this gets set... Access and Refresh get set by setTokens,
        //   which then invokes `notify` to do the token update in the DB. The idea, though, is that auth and refresh
        //   automatically re-set the access token for future requests of the instance of the class and tells the
        //   delegate to update the DB for future requests.
        this.instanceUrl = this.conn.instanceUrl;
        // Clear verifier so it is not sent on future token refreshes
        this.oauth2.codeVerifier = null;
        this.conn.oauth2.codeVerifier = null;
        await this.setTokens(OAuthDetails);
        return this.conn.accessToken;
    }

    async getUserInfo() {
        return this.get('User', this.conn.userInfo.id);
    }

    async create(object, data) {
        const response = await this.conn.sobject(object).create(data);
        return response;
    }

    async update(object, data) {
        const response = await this.conn.sobject(object).update(data);
        return response;
    }

    async upsert(object, data) {
        const response = await this.conn.sobject(object).upsert(data);
        return response;
    }

    async list(object, ids = {}) {
        const response = await this.conn.sobject(object).retrieve(ids);
        return response;
    }

    async find(
        object,
        findFilter = {},
        returnFields = { '*': 1 },
        options = {}
    ) {
        const response = await this.conn
            .sobject(object)
            .find(findFilter, returnFields, options);
        return response;
    }

    async getGlobalMetadata() {
        const response = await this.conn.describeGlobal();
        return response;
    }

    async get(object, id) {
        const response = await this.conn.sobject(object).retrieve(id);
        return response;
    }

    async delete(object, data) {
        const response = await this.conn.sobject(object).del(data);
        return response;
    }

    async refreshAccessToken(res) {
        const OAuthDetails = {
            access_token: res.access_token,
            refresh_token: this.conn.refreshToken,
            instanceUrl: this.conn.instanceUrl,
        };
        // Set the instance URL because I'm not sure this gets set... Access and Refresh get set by setTokens,
        //   which then invokes `notify` to do the token update in the DB. The idea, though, is that auth and refresh
        //   automatically re-set the access token for future requests of the instance of the class and tells the
        //   delegate to update the DB for future requests.
        await this.setTokens(OAuthDetails);
    }
}

module.exports = { Api };
