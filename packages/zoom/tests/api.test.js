const {Api} = require('../api');
const config = require('../defaultConfig.json');
const {randomBytes} = require('crypto');

const apiParams = {
    client_id: process.env.ZOOM_CLIENT_ID,
    client_secret: process.env.ZOOM_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI
};
const api = new Api(apiParams);

const getRandomId = () => randomBytes(10).toString('hex');

describe(`${config.label} Zoom API tests`, () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Constructor
    describe('Constructor', () => {
        it('Should initialize with expected properties', () => {
            expect(api.client_id).toBe(process.env.ZOOM_CLIENT_ID);
            expect(api.client_secret).toBe(process.env.ZOOM_CLIENT_SECRET);
            expect(api.redirect_uri).toBe(process.env.REDIRECT_URI);
            expect(api.baseUrl).toBe('https://api.zoom.us/v2/');
        });
    });

    // User List
    describe('Get user list', () => {
        it('Should call _get with the proper URL', async () => {
            const mockResponse = getRandomId();
            api._get = jest.fn().mockResolvedValue(mockResponse);
            const response = await api.getUserList();
            expect(api._get).toHaveBeenCalledWith({
                url: api.baseUrl + 'users?status=active'
            });
            expect(response).toEqual(mockResponse);
        });
    });

    // Meeting List by User
    describe('Get meeting list by user', () => {
        it('Should call _get with the proper URL', async () => {
            const mockResponse = getRandomId();
            api._get = jest.fn().mockResolvedValue(mockResponse);
            const userId = getRandomId();
            const response = await api.getMeetingListByUser(userId);
            expect(api._get).toHaveBeenCalledWith({
                url: api.baseUrl + `users/${userId}/meetings`
            });
            expect(response).toEqual(mockResponse);
        });
    });

    // Meeting Details
    describe('Get meeting details', () => {
        it('Should call _get with the proper URL', async () => {
            const mockResponse = getRandomId();
            api._get = jest.fn().mockResolvedValue(mockResponse);
            const meetingId = getRandomId();
            const response = await api.getMeetingDetails(meetingId);
            expect(api._get).toHaveBeenCalledWith({
                url: api.baseUrl + `meetings/${meetingId}/`
            });
            expect(response).toEqual(mockResponse);
        });
    });

    // Change Meeting Topic
    describe('Change meeting topic', () => {
        it('Should call _authedPatch with the proper URL and body', async () => {
            const mockResponse = getRandomId();
            api._authedPatch = jest.fn().mockResolvedValue(mockResponse);
            const meetingId = getRandomId();
            const topic = "Updated Topic";
            const response = await api.changeMeetingTopic(meetingId, topic);
            expect(api._authedPatch).toHaveBeenCalledWith(`meetings/${meetingId}/`, {topic});
            expect(response).toEqual(mockResponse);
        });
    });

    // Create New Meeting
    describe('Create new meeting', () => {
        it('Should call _authedPost with the proper URL and body', async () => {
            const mockResponse = getRandomId();
            api._authedPost = jest.fn().mockResolvedValue(mockResponse);
            const userId = getRandomId();
            const topic = "New Meeting";
            const response = await api.createNewMeeting(userId, topic);
            expect(api._authedPost).toHaveBeenCalledWith(`users/${userId}/meetings`, {
                topic: topic,
                type: 2,
                start_time: expect.any(String),
                duration: 1440,
                timezone: 'America/New_York',
            });
            expect(response).toEqual(mockResponse);
        });
    });

    // Delete Meeting
    describe('Delete meeting', () => {
        it('Should call _authedDelete with the proper URL', async () => {
            const mockResponse = getRandomId();
            api._authedDelete = jest.fn().mockResolvedValue(mockResponse);
            const meetingId = getRandomId();
            const response = await api.deleteMeeting(meetingId);
            expect(api._authedDelete).toHaveBeenCalledWith(`meetings/${meetingId}`);
            expect(response).toEqual(mockResponse);
        });
    });
});
