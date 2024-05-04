require('dotenv').config();
const {Api} = require('../api');

describe('42matters API Tests', () => {
    /* eslint-disable camelcase */
    const apiParams = {
        access_token: process.env.MATTERS_ACCESS_TOKEN,
    };
    /* eslint-enable camelcase */

    const api = new Api(apiParams);

    //Disabling auth flow for speed (access tokens expire after ten years)
    describe('Test Auth', () => {
        it('Should retrieve account status', async () => {
            const status = await api.getAccountStatus();
            expect(status.status).toBe('OK');
        });
    });

    describe('Metadata requests', () => {
        it('Should retrieve SDKs', async () => {
            const {results: sdks} = await api.getSDKs();
            expect(sdks).toBeDefined();
            expect(sdks.length).toBeGreaterThan(0);
        })

        it('Should retrieve Google countries', async () => {
            const {countries} = await api.getGoogleCountries();
            expect(countries).toBeDefined();
            expect(countries.length).toBeGreaterThan(0);
        })

        it('Should retrieve Apple countries', async () => {
            const {countries} = await api.getAppleCountries();
            expect(countries).toBeDefined();
            expect(countries.length).toBeGreaterThan(0);
        })

        it('Should retrieve Google categories', async () => {
            const {categories} = await api.getGoogleCategories();
            expect(categories).toBeDefined();
            expect(categories.length).toBeGreaterThan(0);
        })

        it('Should retrieve Apple categories', async () => {
            const {genres} = await api.getAppleGenres();
            expect(genres).toBeDefined();
            expect(genres.length).toBeGreaterThan(0);
        })
    })

    describe('App Data requests', () => {
        describe('Basic requests', () => {
            it('Should retrieve an android app', async () => {
                const appData = await api.getGoogleAppData('com.facebook.katana');
                expect(appData).toBeDefined();
                expect(appData.title).toBe('Facebook');
            });
            it('Should retrieve an android app', async () => {
                const appData = await api.searchGoogleApps('Facebook');
                expect(appData).toBeDefined();
                expect(appData.results).toHaveProperty('length');
                expect(appData.results[0].title).toBe('Facebook');
            });
            it('Should retrieve an apple app', async () => {
                const appData = await api.getAppleAppData('284882215');
                expect(appData).toBeDefined();
                expect(appData.trackCensoredName).toBe('Facebook');
            });
            it('Should retrieve an apple app', async () => {
                const appData = await api.searchAppleApps('Facebook');
                expect(appData).toBeDefined();
                expect(appData.results).toHaveProperty('length');
                expect(appData.results[0].trackCensoredName).toBe('Facebook');
            })
        });
        describe('Bulk requests', () => {
            it('Google bulk request advanced search', async () => {
                const results = await api.queryGoogleApps({
                    query: {
                        query_params: {
                            from: 0,
                            num: 50,
                            sort: "number_ratings",
                            sort_order: "desc"
                        }
                    },
                });
                expect(results).toBeDefined();
                expect(results.results).toHaveProperty('length');
                const ids = results.results.map(app => app.package_name);
                const appData = await api.queryGoogleApps({
                    query: {
                        query_params: {
                            package_name: ids,
                        }
                    }
                });
                expect(appData).toBeDefined();
                expect(appData.results).toHaveProperty('length');
                expect(appData.results.length).toBe(50);
                appData.results.map(app => {
                    expect(ids.find(id => app.package_name === id)).toBeDefined();
                })
            });
            it('Apple bulk request advanced search', async () => {
                const results = await api.queryAppleApps({
                    query: {
                        query_params: {
                            from: 0,
                            num: 50,
                            sort: "number_ratings",
                            sort_order: "desc"
                        }
                    },
                });
                expect(results).toBeDefined();
                expect(results.results).toHaveProperty('length');

                const ids = results.results.map(app => app.trackId);
                const appData = await api.queryAppleApps({
                    query: {
                        query_params: {
                            trackId: ids,
                        }
                    }
                });
                expect(appData).toBeDefined();
                expect(appData.results).toHaveProperty('length');
                expect(appData.results.length).toBe(50);
                appData.results.map(app => {
                    expect(ids.find(id => app.trackId === id)).toBeDefined();
                })
            })
        })

    });
});
