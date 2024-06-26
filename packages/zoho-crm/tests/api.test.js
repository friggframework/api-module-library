const {Authenticator} = require('@friggframework/test');
const {Api} = require('../api');
const config = require('../defaultConfig.json');
const { FetchError } = require('@friggframework/core');

const api = new Api({
    client_id: process.env.ZOHO_CRM_CLIENT_ID,
    client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
    scope: process.env.ZOHO_CRM_SCOPE,
    redirect_uri: `${process.env.REDIRECT_URI}/zoho-crm`,
});

beforeAll(async () => {
    const url = api.getAuthUri();
    const response = await Authenticator.oauth2(url);
    const baseArr = response.base.split('/');
    response.entityType = baseArr[baseArr.length - 1];
    delete response.base;
    await api.getTokenFromCode(response.data.code);
});

describe(`${config.label} API tests`, () => {
    let existingRoleId;
    describe('Test Role resource', () => {
        it('should list all Roles', async () => {
            const response = await api.listRoles();
            expect(response).toHaveProperty('roles');
            expect(response.roles).toBeInstanceOf(Array);
            existingRoleId = response.roles[0].id; // needed later, to delete a Role
        });

        let newRoleId;
        it('should create a new Role', async () => {
            const response = await api.createRole({
                roles: [
                    {'name': 'Test Role 1000', 'description': 'Just testing stuff'}
                ]
            });
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role added');
            newRoleId = response.roles[0].details.id; // store the id of the newly created Role
        });

        it('should get the newly created Role by ID', async () => {
            const response = await api.getRole(newRoleId);
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].id).toBe(newRoleId);
            expect(response.roles[0].name).toBe('Test Role 1000');
            expect(response.roles[0].description).toBe('Just testing stuff');
        });

        let updatedName = 'Foo';
        let updatedDescription = 'Bar';
        it('should update the newly created Role by ID', async () => {
            const response = await api.updateRole(
                newRoleId,
                {roles: [{'name': updatedName, 'description': updatedDescription}]},
            );
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role updated');
        });

        it('should receive the updated values when getting the newly created User by ID', async () => {
            const response = await api.getRole(newRoleId);
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].id).toBe(newRoleId);
            expect(response.roles[0].name).toBe(updatedName);
            expect(response.roles[0].description).toBe(updatedDescription);
        });

        it('should delete the newly created Role by ID', async () => {
            // To delete a Role, the api requires that we send it the ID of
            // another Role, to which all users will be transfered after the delete.
            // We rely on one of the existing Roles, whose ID we saved earlier.
            const response = await api.deleteRole(
                newRoleId,
                {'transfer_to_id': existingRoleId}
            );
            expect(response).toHaveProperty('roles');
            expect(response.roles[0].code).toBe('SUCCESS');
            expect(response.roles[0].message).toBe('Role Deleted');
        });

        it('should throw FetchError when trying to create with empty params', () => {
            expect(async () => await api.createRole()).rejects.toThrow(FetchError)
        });
    });

    describe('Test User resource', () => {
        it('should list all Users', async () => {
            const response = await api.listUsers();
            expect(response).toHaveProperty('users');
            expect(response.users).toBeInstanceOf(Array);
        });

        let newUserId;
        it('should create a new User', async () => {
            // To create a new User in Zoho CRM, we need to specify their
            // Role and Profile by providing the relevant IDs in the request.
            // So we first need to fetch an existing Role and Profile.
            const rolesResponse = await api.listRoles();
            const role = rolesResponse.roles[0];
            const profilesResponse = await api.listProfiles();
            const profile = profilesResponse.profiles[0];
            
            const response = await api.createUser({
                users: [{
                    first_name: 'Test User 1000',
                    email: 'test@friggframework.org',
                    role: role.id,
                    profile: profile.id,
                }]
            });

            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User added');
            newUserId = response.users[0].details.id; // store the id of the newly created User
        });

        it('should get the newly created User by ID', async () => {
            const response = await api.getUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].id).toBe(newUserId);
            expect(response.users[0].first_name).toBe('Test User 1000');
            expect(response.users[0].email).toBe('test@friggframework.org');
        });

        let updatedFirstName = 'Elon';
        let updatedEmail = 'musk@friggframework.com';
        it('should update the newly created User by ID', async () => {
            const response = await api.updateUser(
                newUserId,
                {users: [{'first_name': updatedFirstName, 'email': updatedEmail}]},
            );
            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User updated');
        });

        it('should receive the updated values when getting the newly created User by ID', async () => {
            const response = await api.getUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].id).toBe(newUserId);
            expect(response.users[0].first_name).toBe(updatedFirstName);
            expect(response.users[0].email).toBe(updatedEmail);
        });

        it('should delete the newly created User by ID', async () => {
            const response = await api.deleteUser(newUserId);
            expect(response).toHaveProperty('users');
            expect(response.users[0].code).toBe('SUCCESS');
            expect(response.users[0].message).toBe('User deleted');
        });

        it('should throw FetchError when trying to create with empty params', () => {
            expect(async () => await api.createUser()).rejects.toThrow(FetchError)
        });
    });

    describe('Test Profile resource', () => {
        it('should list all Profiles', async () => {
            const response = await api.listProfiles();
            expect(response).toHaveProperty('profiles');
            expect(response.profiles).toBeInstanceOf(Array);
        });

        it.skip('should create a new Profile', async () => {
            // TODO
        });

        it.skip('should get the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should update the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should receive the updated values when getting the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should delete the newly created Profile by ID', async () => {
            // TODO
        });

        it.skip('should throw FetchError when trying to create with empty params', () => {
            // TODO
        });
    });

});
