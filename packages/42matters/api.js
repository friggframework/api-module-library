const {ApiKeyRequester, ModuleConstants, get} = require('@friggframework/core');


class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.access_token = get(params, 'access_token', null);
        this.baseUrl = 'https://data.42matters.com/api/v2.0/';
        this.endpoints = {
            accountStatus: 'account.json',
            googleLookup: 'android/apps/lookup.json',
            googleSearch: 'android/apps/search.json',
            googleQuery: 'android/apps/query.json',
            appleLookup: 'ios/apps/lookup.json',
            appleSearch: 'ios/apps/search.json',
            appleQuery: 'ios/apps/query.json',
            tencentLookup: 'tencent/android/apps/lookup.json',
            amazonLookup: 'amazon/android/apps/lookup.json',
            sdks: 'sdks/search.json'
        }
        this.URLs = {}
        this.generateUrls();
        // v1 schema json
        this.v1BaseUrl = 'https://data.42matters.com/api/';
        this.v1Endpoints = {
            androidCountries: 'meta/android/apps/app_countries.json',
            iosCountries: 'meta/ios/apps/app_countries.json',
            androidCategories: 'meta/android/apps/app_categories.json',
            iosCategories: 'meta/ios/apps/app_secondary_genres.json',
        }
    }

    generateUrls() {
        for (const key in this.endpoints) {
            if (this.endpoints[key] instanceof Function) {
                this.URLs[key] = (...params) => this.baseUrl + this.endpoints[key](...params)
            } else {
                this.URLs[key] = this.baseUrl + this.endpoints[key];
            }
        }
    }

    async _request(url, options, i = 0) {
        options.query.access_token = this.access_token;
        return super._request(url, options, i);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['access_token'],
                    properties: {
                        access_token: {
                            type: 'string',
                            title: 'Access Token',
                        },
                    },
                },
                uiSchema: {
                    clientKey: {
                        'ui:help':
                            'To obtain your Access Token, log in to 42Matters Launchpad and click Access Token under API.',
                        'ui:placeholder': 'Access Token',
                    },
                },
            },
        };
    }

    // API METHODS

    async getAccountStatus() {
        const options = {
            url: this.URLs.accountStatus
        }
        return this._get(options);
    }

    async getGoogleCategories() {
        const options = {
            url: this.v1BaseUrl + this.v1Endpoints.androidCategories
        }
        return this._get(options);
    }

    async getAppleGenres() {
        const options = {
            url: this.v1BaseUrl + this.v1Endpoints.iosCategories
        }
        return this._get(options);
    }

    async getGoogleCountries() {
        const options = {
            url: this.v1BaseUrl + this.v1Endpoints.androidCountries
        }
        return this._get(options);
    }

    async getAppleCountries() {
        const options = {
            url: this.v1BaseUrl + this.v1Endpoints.iosCountries
        }
        return this._get(options);
    }

    async getSDKs() {
        const options = {
            url: this.URLs.sdks,
            query: {
                platform: 'all',
                q: '*'
            }
        }
        return this._get(options);
    }

    async getGoogleAppData(packageName) {
        const options = {
            url: this.URLs.googleLookup,
            query: {
                p: packageName
            }
        }
        return this._get(options);
    }

    async searchGoogleApps(searchPhrase, optionalParams = {}) {
        const options = {
            url: this.URLs.googleSearch,
            query: {
                q: searchPhrase,
                ...optionalParams
            }
        }
        return this._get(options);
    }

    async queryGoogleApps(query, optionalParams = {}) {
        const options = {
            url: this.URLs.googleQuery,
            body: query,
            query: optionalParams,
            headers: {
                'Content-Type': 'application/json'
            }
        }
        return this._post(options);
    }

    async searchAppleApps(searchPhrase, optionalParams = {}) {
        const options = {
            url: this.URLs.appleSearch,
            query: {
                q: searchPhrase,
                ...optionalParams
            }
        }
        return this._get(options);
    }

    async getAppleAppData(trackId) {
        const options = {
            url: this.URLs.appleLookup,
            query: {
                id: trackId
            }
        }
        return this._get(options);
    }

    async queryAppleApps(query, optionalParams = {}) {
        const options = {
            url: this.URLs.appleQuery,
            body: query,
            query: optionalParams,
            headers: {
                'Content-Type': 'application/json'
            }
        }
        return this._post(options);
    }
}

module.exports = {Api};
