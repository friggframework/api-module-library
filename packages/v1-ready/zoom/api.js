const { get, OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
  constructor(params) {
    super(params);

    this.baseUrl = `https://api.zoom.us/v2`;
    this.client_id = process.env.ZOOM_CLIENT_ID;
    this.client_secret = process.env.ZOOM_CLIENT_SECRET;

    this.authorizationUri = encodeURI(
      `https://zoom.us/oauth/authorize?client_id=${this.client_id}&response_type=code&redirect_uri=${this.redirect_uri}`
    );

    this.URLs = {
      userInfo: '/users/me',
      users: '/users',
      userMeetings: (userId) => `/users/${userId}/meetings`,
      meeting: (meetingId) => `/meetings/${meetingId}`,
    };

    this.tokenUri = `https://zoom.us/oauth/token`;

    this.access_token = get(params, 'access_token', null);
    this.refresh_token = get(params, 'refresh_token', null);
  }

  async getTokenFromCode(code) {
    delete this.access_token;
    return await this.getTokenFromCodeBasicAuthHeader(code);
  }

  async getUserDetails() {
    const options = {
      url: this.baseUrl + this.URLs.userInfo,
    };
    return this._get(options);
  }

  async getUserList(params = {}) {
    const searchParams = new URLSearchParams({ status: 'active', ...params });
    let options = {
      url: `${this.baseUrl}${this.URLs.users}?${searchParams.toString()}`,
    };
    options = await this.addAuthHeaders(options);
    let res = await this._get(options);
    return res;
  }

  async getMeetingListByUser(userId) {
    let options = {
      url: this.baseUrl + this.URLs.userMeetings(userId),
    };
    options = await this.addAuthHeaders(options);
    let res = await this._get(options);
    return res;
  }

  async getMeetingDetails(meetingId) {
    let options = {
      url: this.baseUrl + this.URLs.meeting(meetingId),
    };
    options = await this.addAuthHeaders(options);
    let res = await this._get(options);
    return res;
  }

  async changeMeetingTopic(meetingId, topic) {
    let url = this.URLs.meeting(meetingId);
    let body = {
      topic: `${topic}`,
    };
    let res = await this._authedPatch(url, body);
    return res;
  }

  async createNewMeeting(userId, topic) {
    let url = this.URLs.userMeetings(userId);
    let startTime = new Date().toISOString();
    let body = {
      topic: topic,
      type: 2,
      start_time: startTime,
      duration: 1440,
      timezone: 'America/New_York',
    };
    let res = await this._authedPost(url, body);
    return res;
  }

  async deleteMeeting(meetingId) {
    let url = this.URLs.meeting(meetingId);
    let res = await this._authedDelete(url);
    return res;
  }
}

module.exports = { Api };
