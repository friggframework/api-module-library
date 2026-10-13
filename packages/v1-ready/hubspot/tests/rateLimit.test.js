const { FetchError, RateLimitError } = require('@friggframework/core');
const { Api } = require('../api');

const ONE_HOUR_MS = 3_600_000;

const burstLimitBody = {
    status: 'error',
    message: 'You have reached your ten_secondly_rolling limit.',
    errorType: 'RATE_LIMIT',
    correlationId: '00000000-0000-4000-8000-000000000000',
    policyName: 'TEN_SECONDLY_ROLLING',
};

const dailyLimitBody = {
    status: 'error',
    message: 'You have reached your daily limit.',
    errorType: 'RATE_LIMIT',
    correlationId: '00000000-0000-4000-8000-000000000000',
    policyName: 'DAILY',
};

const burstHeaders = {
    'X-HubSpot-RateLimit-Max': '110',
    'X-HubSpot-RateLimit-Remaining': '0',
    'X-HubSpot-RateLimit-Interval-Milliseconds': '10000',
};

function throttledFetch(responses) {
    const queue = [...responses];
    return jest.fn(async () => {
        const next = queue.shift();
        if (!next) throw new Error('unexpected fetch call');
        const body = next.body ?? {};
        return {
            status: next.status,
            bodyUsed: false,
            headers: new Map(
                Object.entries({
                    'Content-Type': next.contentType ?? 'application/json',
                    ...next.headers,
                })
            ),
            json: async () => body,
            text: jest.fn(async () => next.text ?? JSON.stringify(body)),
        };
    });
}

const limited = (body, headers) => ({ status: 429, body, headers });
const ok = { status: 200, body: { results: [] } };

describe('HubSpot rate limits', () => {
    let delays;

    beforeEach(() => {
        delays = [];
        const realSetTimeout = global.setTimeout;
        jest.spyOn(global, 'setTimeout').mockImplementation(
            (fn, delay, ...args) => {
                delays.push(delay);
                return realSetTimeout(fn, 0, ...args);
            }
        );
        jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => jest.restoreAllMocks());

    const makeApi = (fetch, ApiClass = Api) =>
        new ApiClass({
            fetch,
            requestTimeoutMs: 0,
            delegate: { name: 'hubspot', entity: { id: 7 } },
        });

    describe('a burst 429', () => {
        it('waits as long as Retry-After says, then retries', async () => {
            const fetch = throttledFetch([
                limited(burstLimitBody, {
                    ...burstHeaders,
                    'Retry-After': '2',
                }),
                ok,
            ]);

            const result = await makeApi(fetch).listCompanies();

            expect(result).toEqual({ results: [] });
            expect(delays).toEqual([2_000]);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('waits the 10 second burst window when the response has no Retry-After', async () => {
            const fetch = throttledFetch([
                limited(burstLimitBody, burstHeaders),
                ok,
            ]);

            const result = await makeApi(fetch).listCompanies();

            expect(result).toEqual({ results: [] });
            expect(delays).toEqual([10_000]);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('keeps the burst reason and the policy name when a long Retry-After makes it throw', async () => {
            const fetch = throttledFetch([
                limited(burstLimitBody, { 'Retry-After': '400' }),
                ok,
            ]);

            const error = await makeApi(fetch)
                .listCompanies()
                .catch((e) => e);

            expect(error).toBeInstanceOf(RateLimitError);
            expect(error).toMatchObject({
                reason: 'burst',
                policy: 'TEN_SECONDLY_ROLLING',
                source: 'header',
                waitMs: 400_000,
            });
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('waits the burst window when the body is not JSON', async () => {
            const fetch = throttledFetch([
                {
                    status: 429,
                    contentType: 'text/html',
                    text: '<html>Too Many Requests</html>',
                },
                ok,
            ]);

            await makeApi(fetch).listCompanies();

            expect(delays).toEqual([10_000]);
        });
    });

    describe('a DAILY 429', () => {
        it('throws a RateLimitError that probes again in one hour', async () => {
            const fetch = throttledFetch([limited(dailyLimitBody), ok]);
            const before = Date.now();

            const error = await makeApi(fetch)
                .listCompanies()
                .catch((e) => e);

            expect(error).toBeInstanceOf(RateLimitError);
            expect(error).toBeInstanceOf(FetchError);
            expect(error).toMatchObject({
                isRateLimited: true,
                statusCode: 429,
                reason: 'daily',
                policy: 'DAILY',
                source: 'static',
                waitMs: ONE_HOUR_MS,
                module: 'hubspot',
                scopeKey: 'hubspot:entity:7',
            });
            expect(error.retryAt.getTime()).toBeGreaterThanOrEqual(
                before + ONE_HOUR_MS
            );
            expect(error.retryAt.getTime()).toBeLessThanOrEqual(
                Date.now() + ONE_HOUR_MS
            );
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(delays).toEqual([]);
        });

        it('sleeps the probe interval and retries when the in-process budget allows it', async () => {
            class PatientApi extends Api {
                static rateLimit = {
                    ...Api.rateLimit,
                    maxInProcessWaitMs: ONE_HOUR_MS + 60_000,
                };
            }
            const fetch = throttledFetch([limited(dailyLimitBody), ok]);

            const result = await makeApi(fetch, PatientApi).listCompanies();

            expect(result).toEqual({ results: [] });
            expect(delays).toEqual([ONE_HOUR_MS]);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('links the daily reason to the HubSpot usage guidelines', () => {
            const { links } = Api.rateLimit.userHints.daily;

            expect(links).toEqual([
                {
                    label: expect.any(String),
                    url: 'https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines',
                },
            ]);
        });
    });

    describe('other failures', () => {
        it('does not treat a 403 as a limit', async () => {
            const fetch = throttledFetch([
                {
                    status: 403,
                    body: { status: 'error', category: 'MISSING_SCOPES' },
                },
                ok,
            ]);

            const error = await makeApi(fetch)
                .listCompanies()
                .catch((e) => e);

            expect(error).toBeInstanceOf(FetchError);
            expect(error).not.toBeInstanceOf(RateLimitError);
            expect(error.statusCode).toBe(403);
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(delays).toEqual([]);
        });
    });

    it('declares its limits', () => {
        expect(Api.rateLimit).toMatchObject({
            scope: 'entity',
            windows: [{ name: 'burst', limit: 110, perMs: 10_000 }],
            maxConcurrency: 10,
            parsers: ['retryAfter', 'resetHeaders'],
        });
    });
});
