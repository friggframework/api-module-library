const { globalSetup } = require('@friggframework/test');

module.exports = () => {
    globalSetup();

    process.env.ZOOM_CLIENT_ID = 'ZOOM_CLIENT_ID';
    process.env.ZOOM_CLIENT_SECRET = 'ZOOM_CLIENT_SECRET';
    process.env.REDIRECT_URI = 'http://localhost:3000';
};
