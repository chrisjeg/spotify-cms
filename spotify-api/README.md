# Spotify Sync Engine

A service that synchronizes data between Spotify and Palantir Foundry, providing real-time playlist management and music listening analytics.

## Overview

This application serves as a bridge between Spotify's music streaming platform and Palantir Foundry's data platform, enabling bidirectional synchronization of playlists, tracks, and playback data. The system maintains a persistent connection to both platforms, allowing real-time data updates and synchronization.

## Features

- **Real-time Now Playing Tracking**: Monitors what's currently playing on a user's Spotify account
- **Playlist Synchronization**: Keeps Spotify playlists in sync with Foundry data
- **Track Analytics**: Captures detailed audio features and analysis for played tracks
- **Two-way Data Flow**: Changes in either system propagate to the other automatically
- **Resilient Connections**: Automatic reconnection with exponential backoff on failures
- **Token Management**: Automatic handling of OAuth token refresh and expiration

## Architecture

The application consists of several key components:

- **SpotifyEmitter**: Polls the Spotify API for currently playing tracks and playlists
- **SpotifyTokenCache**: Manages and refreshes OAuth tokens for Spotify API access
- **PlaylistOntologySubscription**: Listens for changes to playlists in Foundry and syncs to Spotify
- **PlaylistTrackOntologySubscription**: Monitors track changes and syncs between systems
- **FoundryPlaylistOperations**: Handles CRUD operations for playlists in Foundry

## Setup

### Prerequisites

- Node.js 20.10.0 or later
- Spotify Developer Account with registered application
- Palantir Foundry access with appropriate permissions
- Docker (for containerized deployment)

### Environment Variables

The application requires the following environment variables:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_ACCESS_TOKEN=initial_access_token
SPOTIFY_REFRESH_TOKEN=initial_refresh_token
FOUNDRY_URL=your_foundry_instance_url
CLIENT_ID=foundry_client_id
CLIENT_SECRET=foundry_client_secret
FOUNDRY_TOKEN=foundry_access_token
```

### Development

1. Clone the repository
2. Create a `.env.development` file with the required environment variables
3. Install dependencies:
   ```
   npm ci
   ```
4. Run in development mode:
   ```
   npm run dev
   ```

### Deployment

The application can be deployed as a Docker container:

```
npm run docker-build
```

This will build a Docker image with the current version from package.json and increment the patch version.

## API

The application interacts with the following APIs:

- **Spotify Web API**: For music playback and playlist management
- **Palantir Foundry API**: For data storage and ontology subscriptions

## License

MIT © Christopher Jeganathan