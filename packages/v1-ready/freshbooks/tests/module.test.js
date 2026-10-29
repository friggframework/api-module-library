const nock = require('nock');
const {
    TOKEN_RESPONSE,
    USER,
    setFreshbooksEnv,
    useMockedHttp,
} = require('./fixtures');

describe('FreshBooks module under core Module', () => {
    let Module;
    let Definition;

    beforeAll(() => {
        setFreshbooksEnv();
        process.env.DB_TYPE = 'postgresql';
        ({ Module } = require('@friggframework/core/modules/module'));
        ({ Definition } = require('../definition'));
    });
    afterAll(() => {
        delete process.env.DB_TYPE;
    });
    useMockedHttp();

    const STORED_CREDENTIAL = {
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        freshbooksUserId: '42',
    };

    const createCredentialStore = () => {
        let stored = { id: 'credential-1', ...STORED_CREDENTIAL };
        return {
            upsertCredential: jest.fn(async ({ details }) => {
                stored = { id: 'credential-1', ...details };
                return stored;
            }),
            updateAuthenticationStatus: jest.fn(),
            findCredentialById: jest.fn(async () => stored),
        };
    };

    const createModule = (
        credentialRepository = createCredentialStore(),
        credentialReloadBackoffMs = []
    ) => {
        const module = new Module({
            userId: 'user-1',
            definition: Definition,
            entity: {
                id: 'entity-1',
                credential: {
                    id: 'credential-1',
                    data: { ...STORED_CREDENTIAL },
                },
            },
        });
        module.credentialRepository = credentialRepository;
        module.api.credentialReloadBackoffMs = credentialReloadBackoffMs;
        return module;
    };

    it('persists the rotated refresh token even when users/me is failing', async () => {
        const usersMe = nock('https://api.freshbooks.com')
            .get('/auth/api/v1/users/me')
            .reply(500)
            .persist();
        nock('https://api.freshbooks.com')
            .post('/auth/oauth/token')
            .reply(200, TOKEN_RESPONSE);
        const module = createModule();

        await module.api.refreshAccessToken({ refresh_token: 'old-refresh' });

        expect(usersMe.isDone()).toBe(false);
        expect(
            module.credentialRepository.upsertCredential
        ).toHaveBeenCalledWith({
            identifiers: { externalId: '42', userId: 'user-1' },
            details: expect.objectContaining({
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                freshbooksUserId: '42',
                authIsValid: true,
            }),
        });
    });

    it('refreshes after a 401 on a normal call and retries it with the new token', async () => {
        const api = nock('https://api.freshbooks.com');
        api.get('/auth/api/v1/users/me')
            .matchHeader('authorization', 'Bearer old-access')
            .reply(401);
        api.post(
            '/auth/oauth/token',
            (body) => body.refresh_token === 'old-refresh'
        ).reply(200, TOKEN_RESPONSE);
        api.get('/auth/api/v1/users/me')
            .matchHeader('authorization', 'Bearer new-access')
            .reply(200, { response: USER });
        const module = createModule();

        const details = await module.api.getUserDetails();

        expect(details).toEqual(USER);
        expect(module.api.refresh_token).toBe('new-refresh');
        expect(
            module.credentialRepository.upsertCredential
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                details: expect.objectContaining({
                    refresh_token: 'new-refresh',
                }),
            })
        );
    });

    it('marks the credential invalid and rejects the call when the refresh is refused with invalid_grant', async () => {
        const api = nock('https://api.freshbooks.com');
        api.get('/auth/api/v1/users/me').reply(401);
        api.post('/auth/oauth/token').reply(400, { error: 'invalid_grant' });
        const module = createModule();

        await expect(module.api.getUserDetails()).rejects.toMatchObject({
            statusCode: 401,
        });

        expect(
            module.credentialRepository.updateAuthenticationStatus
        ).toHaveBeenCalledWith('credential-1', false);
        expect(
            module.credentialRepository.upsertCredential
        ).not.toHaveBeenCalled();
    });

    describe('rotating single-use refresh tokens under concurrency', () => {
        it('shares one refresh between concurrent 401s on the same instance', async () => {
            const api = nock('https://api.freshbooks.com');
            api.get('/auth/api/v1/users/me')
                .times(2)
                .matchHeader('authorization', 'Bearer old-access')
                .reply(401);
            const tokenCall = api
                .post(
                    '/auth/oauth/token',
                    (body) => body.refresh_token === 'old-refresh'
                )
                .reply(200, TOKEN_RESPONSE);
            api.get('/auth/api/v1/users/me')
                .times(2)
                .matchHeader('authorization', 'Bearer new-access')
                .reply(200, { response: USER });
            const credentialRepository = createCredentialStore();
            const module = createModule(credentialRepository);

            const results = await Promise.all([
                module.api.getUserDetails(),
                module.api.getUserDetails(),
            ]);

            expect(results).toEqual([USER, USER]);
            expect(tokenCall.isDone()).toBe(true);
            expect(nock.pendingMocks()).toEqual([]);
            expect(credentialRepository.upsertCredential).toHaveBeenCalledTimes(
                1
            );
            expect(credentialRepository.upsertCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: expect.objectContaining({
                        refresh_token: 'new-refresh',
                    }),
                })
            );
        });

        describe('two instances sharing one stored credential', () => {
            const ROTATED_BY_A = {
                access_token: 'access-A',
                refresh_token: 'refresh-A',
                expires_in: 43200,
            };

            const rotateWithInstanceA = async (credentialRepository) => {
                nock('https://api.freshbooks.com')
                    .post(
                        '/auth/oauth/token',
                        (body) => body.refresh_token === 'old-refresh'
                    )
                    .reply(200, ROTATED_BY_A);
                const instanceA = createModule(credentialRepository);
                await instanceA.api.refreshAccessToken({
                    refresh_token: 'old-refresh',
                });
            };

            it('adopts the winner credential after invalid_grant and retries without invalidating', async () => {
                const credentialRepository = createCredentialStore();
                await rotateWithInstanceA(credentialRepository);
                const instanceB = createModule(credentialRepository, [1]);
                credentialRepository.findCredentialById.mockResolvedValueOnce({
                    id: 'credential-1',
                    ...STORED_CREDENTIAL,
                });
                const api = nock('https://api.freshbooks.com');
                api.get('/auth/api/v1/users/me')
                    .matchHeader('authorization', 'Bearer old-access')
                    .reply(401);
                api.post(
                    '/auth/oauth/token',
                    (body) => body.refresh_token === 'old-refresh'
                ).reply(400, { error: 'invalid_grant' });
                api.get('/auth/api/v1/users/me')
                    .matchHeader('authorization', 'Bearer access-A')
                    .reply(200, { response: USER });

                const details = await instanceB.api.getUserDetails();

                expect(details).toEqual(USER);
                expect(instanceB.api.access_token).toBe('access-A');
                expect(instanceB.api.refresh_token).toBe('refresh-A');
                expect(
                    credentialRepository.updateAuthenticationStatus
                ).not.toHaveBeenCalled();
                expect(
                    credentialRepository.upsertCredential
                ).toHaveBeenCalledTimes(1);
                expect(nock.pendingMocks()).toEqual([]);
            });

            it('adopts the winner credential before spending its own refresh when the write is already visible', async () => {
                const credentialRepository = createCredentialStore();
                await rotateWithInstanceA(credentialRepository);
                const instanceB = createModule(credentialRepository);
                const api = nock('https://api.freshbooks.com');
                api.get('/auth/api/v1/users/me')
                    .matchHeader('authorization', 'Bearer old-access')
                    .reply(401);
                api.get('/auth/api/v1/users/me')
                    .matchHeader('authorization', 'Bearer access-A')
                    .reply(200, { response: USER });

                const details = await instanceB.api.getUserDetails();

                expect(details).toEqual(USER);
                expect(instanceB.api.refresh_token).toBe('refresh-A');
                expect(
                    credentialRepository.updateAuthenticationStatus
                ).not.toHaveBeenCalled();
                expect(nock.pendingMocks()).toEqual([]);
            });
        });
    });
});
