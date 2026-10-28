const { USER, business, userWith, setFreshbooksEnv } = require('./fixtures');

describe('FreshBooks Definition', () => {
    let Definition;

    beforeAll(() => {
        setFreshbooksEnv();
        ({ Definition } = require('../definition'));
    });

    const apiReturning = (user) => ({
        getUserDetails: jest.fn().mockResolvedValue(user),
    });

    it('is named freshbooks and uses the Api class', () => {
        const { Api } = require('../api');
        expect(Definition.moduleName).toBe('freshbooks');
        expect(Definition.getName()).toBe('freshbooks');
        expect(Definition.API).toBe(Api);
    });

    it('reads client credentials and redirect uri from the environment', () => {
        expect(Definition.env).toEqual({
            client_id: 'client-id',
            client_secret: 'client-secret',
            redirect_uri: 'https://app.example.com/redirect/freshbooks',
        });
    });

    it('persists both tokens and the user id on the credential and nothing on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'freshbooksUserId'],
            entity: [],
        });
    });

    it('exchanges the callback code for tokens', async () => {
        const api = {
            getTokenFromCode: jest
                .fn()
                .mockResolvedValue({ access_token: 'a' }),
        };

        const result = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });

        expect(api.getTokenFromCode).toHaveBeenCalledWith('auth-code');
        expect(result).toEqual({ access_token: 'a' });
    });

    describe('getEntityDetails', () => {
        const entityDetails = (user) =>
            Definition.requiredAuthMethods.getEntityDetails(
                apiReturning(user),
                {},
                {},
                'user-1'
            );

        it('keys the entity by the business account_id', async () => {
            await expect(entityDetails(USER)).resolves.toEqual({
                identifiers: { externalId: 'acct-1', user: 'user-1' },
                details: { name: 'Analytical Engines Ltd' },
            });
        });

        it('throws a clear error when the user belongs to several businesses', async () => {
            const user = userWith(
                business('acct-1', 'One'),
                business('acct-2', 'Two')
            );

            await expect(entityDetails(user)).rejects.toThrow(
                /multiple FreshBooks businesses/i
            );
        });

        it('lists the choices as name (account_id) when several businesses need a choice', async () => {
            const user = userWith(
                business('acct-1', 'One'),
                business('acct-2', 'Two')
            );

            await expect(entityDetails(user)).rejects.toThrow(
                /One \(acct-1\), Two \(acct-2\)/
            );
        });

        describe('with a chosen account_id', () => {
            const user = userWith(
                business('acct-1', 'One'),
                business('acct-2', 'Two')
            );
            const chosen = (accountId, target = user) =>
                Definition.requiredAuthMethods.getEntityDetails(
                    apiReturning(target),
                    { code: 'abc', account_id: accountId },
                    {},
                    'user-1'
                );

            it('keys the entity by the chosen business among several', async () => {
                await expect(chosen('acct-2')).resolves.toEqual({
                    identifiers: { externalId: 'acct-2', user: 'user-1' },
                    details: { name: 'Two' },
                });
            });

            it('throws when the chosen business is not one of the user memberships', async () => {
                await expect(chosen('acct-9')).rejects.toThrow(
                    /business not available to this user/i
                );
            });

            it('throws when the chosen business matches only a membership without an account_id', async () => {
                await expect(
                    chosen(
                        'acct-9',
                        userWith(
                            { business: { name: 'No id' } },
                            business('acct-1', 'One')
                        )
                    )
                ).rejects.toThrow(/business not available to this user/i);
            });

            it('uses the chosen business when the user has just one', async () => {
                await expect(chosen('acct-1', USER)).resolves.toMatchObject({
                    identifiers: { externalId: 'acct-1' },
                });
            });

            it.each([' acct-2 ', 'ACCT-2', 'Acct-2'])(
                'rejects %j without trimming or case folding',
                async (accountId) => {
                    await expect(chosen(accountId)).rejects.toThrow(
                        /business not available to this user/i
                    );
                }
            );

            it('connects a business_partner membership', async () => {
                const partner = userWith(
                    {
                        role: 'owner',
                        business: { account_id: 'acct-1', name: 'One' },
                    },
                    {
                        role: 'business_partner',
                        business: { account_id: 'acct-2', name: 'Two' },
                    }
                );

                await expect(chosen('acct-2', partner)).resolves.toEqual({
                    identifiers: { externalId: 'acct-2', user: 'user-1' },
                    details: { name: 'Two' },
                });
            });

            it('ignores an empty account_id and falls back to the single business', async () => {
                await expect(chosen('', USER)).resolves.toMatchObject({
                    identifiers: { externalId: 'acct-1' },
                });
            });
        });

        it('throws a clear error when the user belongs to no business', async () => {
            await expect(entityDetails(userWith())).rejects.toThrow(
                /no FreshBooks business/i
            );
        });

        it('throws a clear error when the only membership lacks an account_id', async () => {
            await expect(
                entityDetails(userWith({ business: { name: 'No id' } }))
            ).rejects.toThrow(/no FreshBooks business/i);
        });

        it('throws a clear error when the only membership has a null business', async () => {
            await expect(
                entityDetails(userWith({ business: null }))
            ).rejects.toThrow(/no FreshBooks business/i);
        });

        it('ignores memberships without an account_id next to a valid business', async () => {
            const user = userWith(
                { business: { name: 'No id' } },
                { business: null },
                business('acct-1', 'Analytical Engines Ltd')
            );

            await expect(entityDetails(user)).resolves.toEqual({
                identifiers: { externalId: 'acct-1', user: 'user-1' },
                details: { name: 'Analytical Engines Ltd' },
            });
        });

        it('throws a clear error when memberships are missing from the response', async () => {
            await expect(entityDetails({ id: 42 })).rejects.toThrow(
                /no FreshBooks business/i
            );
        });
    });

    describe('getCredentialDetails', () => {
        it('keys the credential by the persisted user id without a network call', async () => {
            const api = { freshbooksUserId: '42', getUserDetails: jest.fn() };

            const details =
                await Definition.requiredAuthMethods.getCredentialDetails(
                    api,
                    'user-1'
                );

            expect(api.getUserDetails).not.toHaveBeenCalled();
            expect(details).toEqual({
                identifiers: { externalId: '42', userId: 'user-1' },
                details: {},
            });
        });

        it('falls back to users/me on first auth when no user id is known yet', async () => {
            const api = apiReturning(USER);

            const details =
                await Definition.requiredAuthMethods.getCredentialDetails(
                    api,
                    'user-1'
                );

            expect(api.getUserDetails).toHaveBeenCalledTimes(1);
            expect(details).toEqual({
                identifiers: { externalId: '42', userId: 'user-1' },
                details: {},
            });
        });
    });

    it('tests auth by fetching users/me', async () => {
        const api = apiReturning(USER);

        await expect(
            Definition.requiredAuthMethods.testAuthRequest(api)
        ).resolves.toEqual(USER);
        expect(api.getUserDetails).toHaveBeenCalledTimes(1);
    });
});
