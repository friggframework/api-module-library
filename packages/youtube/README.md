# YouTube API Module

A comprehensive Node.js module for integrating with YouTube's Data API v3, built for the Frigg Framework.

## Overview

This module provides seamless integration with YouTube, supporting video management, channel operations, playlist management, and content discovery. It handles Google OAuth2 authentication and provides methods for managing YouTube resources.

## Installation

```bash
npm install @friggframework/api-module-youtube
```

## Configuration

### Environment Variables

```bash
YOUTUBE_CLIENT_ID=your_google_client_id
YOUTUBE_CLIENT_SECRET=your_google_client_secret
YOUTUBE_SCOPE=https://www.googleapis.com/auth/youtube
REDIRECT_URI=your_redirect_uri_base
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create OAuth2 credentials
5. Configure redirect URI: `{REDIRECT_URI}/youtube`
6. Set required scopes:
   - `https://www.googleapis.com/auth/youtube` - Full YouTube access
   - `https://www.googleapis.com/auth/youtube.readonly` - Read-only access
   - `https://www.googleapis.com/auth/youtube.upload` - Upload videos

## Usage

### Basic Setup

```javascript
const { Api, Definition } = require('@friggframework/api-module-youtube');

const api = new Api({
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/youtube`,
    scope: 'https://www.googleapis.com/auth/youtube'
});
```

### Authentication Flow

```javascript
// 1. Get authorization URL
const authUrl = api.getAuthUri();

// 2. Handle callback
const tokens = await api.getTokenFromCode(authorizationCode);

// 3. Get channel details
const channel = await api.getMyChannel();
```

### Core Operations

```javascript
// Get my channel
const myChannel = await api.getMyChannel();

// Search videos
const searchResults = await api.search({
    q: 'nodejs tutorial',
    type: 'video',
    maxResults: 25
});

// Get videos by ID
const videos = await api.getVideos({
    id: 'video_id_1,video_id_2'
});

// Get playlists
const playlists = await api.getPlaylists({
    channelId: 'channel_id',
    maxResults: 50
});

// Subscribe to a channel
await api.subscribe('channel_id');
```

## API Reference

### Core Methods

#### Authentication & Channels
- `getMyChannel()` - Get authenticated user's channel
- `getChannels(params)` - Get channel information

#### Videos
- `getVideos(params)` - Get video details
- `uploadVideo(videoData)` - Upload video (requires multipart handling)

#### Search & Discovery
- `search(params)` - Search YouTube content

#### Playlists
- `getPlaylists(params)` - Get playlist information
- `createPlaylist(playlistData)` - Create new playlist

#### Subscriptions
- `getSubscriptions(params)` - Get user subscriptions
- `subscribe(channelId)` - Subscribe to channel

## Resources

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [Google OAuth2 Guide](https://developers.google.com/identity/protocols/oauth2)

## License

MIT License - see LICENSE file for details.