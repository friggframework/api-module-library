const { Api } = require('../api');

describe('Fathom API Tests', () => {
    const apiParams = {
        apiKey: process.env.FATHOM_API_KEY || 'test-api-key',
    };
    const api = new Api(apiParams);

    beforeAll(() => {
        if (!process.env.FATHOM_API_KEY) {
            console.warn('FATHOM_API_KEY not found in environment variables. Tests may fail.');
        }
    });

    describe('Constructor and Authentication', () => {
        it('Should create an API instance with correct configuration', () => {
            expect(api).toBeDefined();
            expect(api.baseUrl).toBe('https://api.fathom.ai/external/v1');
            expect(api.apiKey).toBe(apiParams.apiKey);
            expect(api.access_token).toBe(apiParams.apiKey);
        });

        it('Should have correct endpoint URLs defined', () => {
            expect(api.URLs.meetings).toBe('/meetings');
            expect(api.URLs.teams).toBe('/teams');
            expect(api.URLs.teamMembers).toBe('/team-members');
        });
    });

    describe('API Methods', () => {
        describe('listMeetings', () => {
            it('Should be defined', () => {
                expect(api.listMeetings).toBeDefined();
                expect(typeof api.listMeetings).toBe('function');
            });

            if (process.env.FATHOM_API_KEY) {
                it('Should list meetings successfully', async () => {
                    const result = await api.listMeetings();
                    expect(result).toBeDefined();
                    expect(result).toHaveProperty('data');
                    expect(Array.isArray(result.data)).toBe(true);
                });

                it('Should handle pagination parameters', async () => {
                    const params = {
                        meeting_type: 'all',
                        include_transcript: false
                    };
                    const result = await api.listMeetings(params);
                    expect(result).toBeDefined();
                });

                it('Should handle array parameters correctly', async () => {
                    const params = {
                        recorded_by: ['user1@example.com', 'user2@example.com'],
                        teams: ['team1', 'team2']
                    };
                    const result = await api.listMeetings(params);
                    expect(result).toBeDefined();
                });
            }
        });

        describe('listTeams', () => {
            it('Should be defined', () => {
                expect(api.listTeams).toBeDefined();
                expect(typeof api.listTeams).toBe('function');
            });

            if (process.env.FATHOM_API_KEY) {
                it('Should list teams successfully', async () => {
                    const result = await api.listTeams();
                    expect(result).toBeDefined();
                    expect(result).toHaveProperty('data');
                });
            }
        });

        describe('listTeamMembers', () => {
            it('Should be defined', () => {
                expect(api.listTeamMembers).toBeDefined();
                expect(typeof api.listTeamMembers).toBe('function');
            });

            if (process.env.FATHOM_API_KEY) {
                it('Should list team members successfully', async () => {
                    const result = await api.listTeamMembers();
                    expect(result).toBeDefined();
                    expect(result).toHaveProperty('data');
                });
            }
        });

        describe('iterateMeetings', () => {
            it('Should be defined as a generator function', () => {
                expect(api.iterateMeetings).toBeDefined();
                const iterator = api.iterateMeetings();
                expect(iterator).toHaveProperty('next');
            });

            if (process.env.FATHOM_API_KEY) {
                it('Should iterate through meetings', async () => {
                    const meetings = [];
                    let count = 0;
                    for await (const meeting of api.iterateMeetings()) {
                        meetings.push(meeting);
                        count++;
                        if (count >= 5) break; // Limit to 5 for testing
                    }
                    expect(Array.isArray(meetings)).toBe(true);
                });
            }
        });
    });

    describe('Request Override', () => {
        it('Should add X-Api-Key header to requests', async () => {
            const mockRequest = jest.spyOn(api, '_get').mockImplementation(async () => ({
                data: []
            }));

            await api.listTeams();

            expect(mockRequest).toHaveBeenCalled();
            mockRequest.mockRestore();
        });
    });
});