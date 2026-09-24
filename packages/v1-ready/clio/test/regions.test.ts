import { describe, it, expect, vi, afterEach } from 'vitest';
import { Api } from '../src/api';
import { Definition } from '../src/definition';

const US_CLIENT = { client_id: 'us-client', client_secret: 'us-secret' };
const CA_CLIENT = { client_id: 'ca-client', client_secret: 'ca-secret' };

const buildApi = (params: Record<string, unknown> = {}) =>
    new Api({
        ...US_CLIENT,
        redirect_uri: 'https://example.com/redirect/clio',
        ca_client_id: CA_CLIENT.client_id,
        ca_client_secret: CA_CLIENT.client_secret,
        ...params,
    } as any);

describe('Clio regions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('defaults to the US host for the API, authorize and token URLs', () => {
        const api = buildApi();

        expect(api.baseUrl).toBe('https://app.clio.com/api/v4');
        expect(api.tokenUri).toBe('https://app.clio.com/oauth/token');
        expect(api.authorizationUri).toBe(
            'https://app.clio.com/oauth/authorize?client_id=us-client&redirect_uri=https://example.com/redirect/clio&response_type=code',
        );
        expect(api.client_id).toBe('us-client');
    });

    it('uses the regional host and client for a persisted region', () => {
        const api = buildApi({ region: 'ca' });

        expect(api.baseUrl).toBe('https://ca.app.clio.com/api/v4');
        expect(api.tokenUri).toBe('https://ca.app.clio.com/oauth/token');
        expect(api.authorizationUri).toBe(
            'https://ca.app.clio.com/oauth/authorize?client_id=ca-client&redirect_uri=https://example.com/redirect/clio&response_type=code',
        );
        expect(api.client_id).toBe('ca-client');
        expect(api.client_secret).toBe('ca-secret');
    });

    it('setRegion moves every URL and the client to the new region', () => {
        const api = buildApi();

        api.setRegion('ca');

        expect(api.region).toBe('ca');
        expect(api.baseUrl).toBe('https://ca.app.clio.com/api/v4');
        expect(api.tokenUri).toBe('https://ca.app.clio.com/oauth/token');
        expect(api.authorizationUri).toContain(
            'https://ca.app.clio.com/oauth/authorize?client_id=ca-client',
        );
        expect(api.client_id).toBe('ca-client');
        expect(api.client_secret).toBe('ca-secret');
    });

    it('rejects an unknown region', () => {
        expect(() => buildApi().setRegion('xx' as any)).toThrow(
            'Invalid Clio region: xx',
        );
    });

    describe('getToken', () => {
        it('exchanges the code against the region sent with it', async () => {
            const api = buildApi();
            const exchange = vi
                .spyOn(api, 'getTokenFromCode')
                .mockImplementation(async function (this: Api) {
                    return {
                        tokenUri: this.tokenUri,
                        client_id: this.client_id,
                    } as any;
                });

            const result = await Definition.requiredAuthMethods.getToken(api, {
                code: 'abc',
                region: 'ca',
            });

            expect(exchange).toHaveBeenCalledWith('abc');
            expect(result).toEqual({
                tokenUri: 'https://ca.app.clio.com/oauth/token',
                client_id: 'ca-client',
            });
            expect(api.region).toBe('ca');
        });

        it('keeps the US region when no region is sent', async () => {
            const api = buildApi();
            vi.spyOn(api, 'getTokenFromCode').mockResolvedValue({} as any);

            await Definition.requiredAuthMethods.getToken(api, { code: 'abc' });

            expect(api.region).toBe('us');
            expect(api.tokenUri).toBe('https://app.clio.com/oauth/token');
        });

        it('fails before the exchange when the region has no client configured', async () => {
            const api = buildApi({ ca_client_id: '', ca_client_secret: '' });
            const exchange = vi.spyOn(api, 'getTokenFromCode');

            await expect(
                Definition.requiredAuthMethods.getToken(api, {
                    code: 'abc',
                    region: 'ca',
                }),
            ).rejects.toThrow(
                'Clio ca client is not configured (set CLIO_CA_CLIENT_ID and CLIO_CA_CLIENT_SECRET)',
            );
            expect(exchange).not.toHaveBeenCalled();
        });

        it('rejects an unknown region', async () => {
            const api = buildApi();

            await expect(
                Definition.requiredAuthMethods.getToken(api, {
                    code: 'abc',
                    region: 'xx',
                }),
            ).rejects.toThrow('Invalid Clio region: xx');
        });
    });

    it('declares a client id and secret env var for every non-US region', () => {
        expect(Object.keys(Definition.env)).toEqual(
            expect.arrayContaining([
                'eu_client_id',
                'eu_client_secret',
                'ca_client_id',
                'ca_client_secret',
                'au_client_id',
                'au_client_secret',
            ]),
        );
    });
});
