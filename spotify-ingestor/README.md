# Spotify Ingestor Compute Module

A specialized Compute Module for ingesting real-time Spotify data into data streams.

## Overview

The Spotify Ingestor is a compute module that connects to Spotify's API and streams real-time data about currently playing tracks, audio features, and playlist changes. This data is then processed and written to streaming endpoints, enabling analysis of music listening habits and playlist management.

## Features

- **Real-time Music Tracking**: Captures currently playing tracks from Spotify
- **Audio Feature Analysis**: Collects detailed audio characteristics for played tracks
- **Playlist Monitoring**: Tracks creation, modification, and deletion of playlists
- **Data Streaming**: Writes events to configurable data streams for further analysis
- **Token Management**: Automatic OAuth token refresh mechanism
- **Development Mode**: Support for local development with environment variable fallbacks

## Architecture

The application consists of several components:

- **SpotifyEmitter**: Monitors Spotify for currently playing tracks and playlist changes
- **SpotifyTokenCache**: Manages OAuth token lifecycle for Spotify API
- **ComputeModule**: Integration with Palantir Compute Module framework for data streaming

## Setup

### Prerequisites

- Node.js 20.10.0 or later
- Spotify Developer Account with registered application
- Palantir Foundry with Compute Module support
- Docker (for containerized deployment)

### Environment Variables

The application requires the following environment variables:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_ACCESS_TOKEN=initial_access_token
SPOTIFY_REFRESH_TOKEN=initial_refresh_token
FOUNDRY_URL=your_foundry_instance_url
NODE_ENV=development|production
```

### Development

1. Create a `.env.development` file with the required environment variables
2. Install dependencies:
   ```
   npm ci
   ```
3. Run in development mode:
   ```
   npm run dev
   ```

### Token Management

To obtain initial tokens for Spotify API access:

```
npm run tokens
```

This will start a local OAuth flow to capture the necessary tokens.

### Deployment

The application can be deployed as a Docker container using the provided Dockerfile.

## Data Streams

The ingestor writes to the following data streams:

- **now-playing**: Currently playing track information with timestamps
- **tracks**: Detailed track metadata including name, artists, and popularity
- **track-features**: Audio characteristics like tempo, energy, and danceability
- **playlists**: Playlist metadata with change tracking

## License

MIT © Christopher Jeganathan
