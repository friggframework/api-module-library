const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://s3.amazonaws.com';

        this.URLs = {
            // Buckets
            buckets: '/',
            bucketById: (bucketName) => `/${bucketName}`,
            
            // Objects
            objects: (bucketName) => `/${bucketName}`,
            objectById: (bucketName, objectKey) => `/${bucketName}/${objectKey}`,
            
            // ACL
            bucketAcl: (bucketName) => `/${bucketName}?acl`,
            objectAcl: (bucketName, objectKey) => `/${bucketName}/${objectKey}?acl`,
            
            // Versioning
            versioning: (bucketName) => `/${bucketName}?versioning`,
            
            // Lifecycle
            lifecycle: (bucketName) => `/${bucketName}?lifecycle`,
        };

        this.authorizationUri = encodeURI(
            `https://auth.aws.amazon.com/oauth2/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://auth.aws.amazon.com/oauth2/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);

        if (newRefreshToken) {
            this.refresh_token = newRefreshToken;
        }

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Buckets   **********************************

    async listBuckets() {
        const options = {
            url: this.baseUrl + this.URLs.buckets,
        };
        return this._get(options);
    }

    async createBucket(bucketName, region = 'us-east-1') {
        const options = {
            url: this.baseUrl + this.URLs.bucketById(bucketName),
            headers: {
                'x-amz-bucket-region': region
            }
        };
        return this._put(options);
    }

    async deleteBucket(bucketName) {
        const options = {
            url: this.baseUrl + this.URLs.bucketById(bucketName),
        };
        return this._delete(options);
    }

    async getBucketInfo(bucketName) {
        const options = {
            url: this.baseUrl + this.URLs.bucketById(bucketName),
        };
        return this._head(options);
    }

    // **************************   Objects   **********************************

    async listObjects(bucketName, prefix = '') {
        const options = {
            url: this.baseUrl + this.URLs.objects(bucketName),
            query: {
                prefix: prefix,
                'list-type': 2
            }
        };
        return this._get(options);
    }

    async uploadObject(bucketName, objectKey, data, contentType = 'application/octet-stream') {
        const options = {
            url: this.baseUrl + this.URLs.objectById(bucketName, objectKey),
            body: data,
            headers: {
                'Content-Type': contentType
            }
        };
        return this._put(options, false);
    }

    async getObject(bucketName, objectKey) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(bucketName, objectKey),
        };
        return this._get(options);
    }

    async deleteObject(bucketName, objectKey) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(bucketName, objectKey),
        };
        return this._delete(options);
    }

    async copyObject(sourceBucket, sourceKey, destBucket, destKey) {
        const options = {
            url: this.baseUrl + this.URLs.objectById(destBucket, destKey),
            headers: {
                'x-amz-copy-source': `/${sourceBucket}/${sourceKey}`
            }
        };
        return this._put(options);
    }

    // **************************   ACL   **********************************

    async getBucketAcl(bucketName) {
        const options = {
            url: this.baseUrl + this.URLs.bucketAcl(bucketName),
        };
        return this._get(options);
    }

    async getObjectAcl(bucketName, objectKey) {
        const options = {
            url: this.baseUrl + this.URLs.objectAcl(bucketName, objectKey),
        };
        return this._get(options);
    }

    // **************************   Versioning   **********************************

    async getBucketVersioning(bucketName) {
        const options = {
            url: this.baseUrl + this.URLs.versioning(bucketName),
        };
        return this._get(options);
    }

    async setBucketVersioning(bucketName, status) {
        const options = {
            url: this.baseUrl + this.URLs.versioning(bucketName),
            body: `<VersioningConfiguration><Status>${status}</Status></VersioningConfiguration>`,
            headers: {
                'Content-Type': 'application/xml'
            }
        };
        return this._put(options, false);
    }
}

module.exports = { Api };