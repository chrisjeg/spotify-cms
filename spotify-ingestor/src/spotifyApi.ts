import axios, { AxiosError } from "axios";
import qs from "qs";
import { Buffer } from "buffer";

export interface SegmentData {
  start: number;
  duration: number;
  confidence: number;
}

export interface Section {
  start: number;
  duration: number;
  confidence: number;
  loudness: number;
  tempo: number;
  tempo_confidence: number;
  key: number;
  key_confidence: number;
  mode: number;
  mode_confidence: number;
  time_signature: number;
  time_signature_confidence: number;
}

/**
 * Gets the user's currently playing track
 * @param accessToken Spotify API access token
 * @returns The currently playing track or null if nothing is playing
 */
export const getCurrentlyPlaying = async (
  accessToken: string
): Promise<SpotifyApi.CurrentlyPlayingResponse | null> => {
  try {
    const response = await axios.get<SpotifyApi.CurrentlyPlayingResponse>(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        validateStatus: (status) => status === 200 || status === 204,
      }
    );

    // API returns 204 No Content when nothing is playing
    if (response.status === 204) {
      return null;
    }

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(
      `Failed to get currently playing track: ${axiosError.message}`
    );
  }
};

/**
 * Gets audio features for a track
 * @param trackId Spotify track ID
 * @param accessToken Spotify API access token
 * @returns Track audio features
 */
export const getSpotifyFeatures = async (
  trackId: string,
  accessToken: string
): Promise<SpotifyApi.AudioFeaturesResponse> => {
  try {
    const { data } = await axios.get<SpotifyApi.AudioFeaturesResponse>(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(
      `Failed to get audio features for track ${trackId}: ${axiosError.message}`
    );
  }
};

/**
 * Gets detailed audio analysis for a track
 * @param trackId Spotify track ID
 * @param accessToken Spotify API access token
 * @returns Track audio analysis
 */
export const getSpotifyAnalysis = async (
  trackId: string,
  accessToken: string
): Promise<SpotifyApi.AudioAnalysisResponse> => {
  try {
    const { data } = await axios.get<SpotifyApi.AudioAnalysisResponse>(
      `https://api.spotify.com/v1/audio-analysis/${trackId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(
      `Failed to get audio analysis for track ${trackId}: ${axiosError.message}`
    );
  }
};

/**
 * Gets all user playlists with pagination handling
 * @param accessToken Spotify API access token
 * @param limit Maximum number of items per page (max 50)
 * @returns All user playlists
 */
export const getUserPlaylists = async (
  accessToken: string,
  limit: number = 50
): Promise<SpotifyApi.ListOfUsersPlaylistsResponse> => {
  if (limit < 1 || limit > 50) {
    throw new Error("Limit must be between 1 and 50");
  }

  try {
    let allPlaylists: SpotifyApi.PlaylistObjectSimplified[] = [];
    let url = `https://api.spotify.com/v1/me/playlists?limit=${limit}`;

    while (url) {
      const { data } = await axios.get<SpotifyApi.ListOfUsersPlaylistsResponse>(
        url,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      allPlaylists = [...allPlaylists, ...data.items];
      url = data.next || "";
    }

    console.log(`Fetched ${allPlaylists.length} playlists from Spotify API`);

    return {
      items: allPlaylists,
      total: allPlaylists.length,
      limit,
      offset: 0,
      href: `https://api.spotify.com/v1/me/playlists?limit=${limit}`,
      next: null,
      previous: null,
    } as SpotifyApi.ListOfUsersPlaylistsResponse;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(`Failed to get user playlists: ${axiosError.message}`);
  }
};

/**
 * Gets detailed playlist information including tracks
 * @param playlistId Spotify playlist ID
 * @param accessToken Spotify API access token
 * @returns Detailed playlist information
 */
export const getPlaylistDetails = async (
  playlistId: string,
  accessToken: string
): Promise<SpotifyApi.SinglePlaylistResponse> => {
  if (!playlistId) {
    throw new Error("Playlist ID is required");
  }

  try {
    const { data } = await axios.get<SpotifyApi.SinglePlaylistResponse>(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return data;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw new Error(
      `Failed to get playlist details for ${playlistId}: ${axiosError.message}`
    );
  }
};

/**
 * Token request types for Spotify API authentication
 */
export type TokenRequest =
  | {
      grant_type: "refresh_token";
      refresh_token: string;
    }
  | {
      grant_type: "authorization_code";
      code: string;
      redirect_uri: string;
    };

/**
 * Response from the Spotify token endpoint
 */
export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number; // seconds
  refresh_token?: string;
}

/**
 * Structured token data used in the application
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiryTime: number; // milliseconds since epoch
  scope: string;
}

export const modifyPlaylistDetails = async (
  accessToken: string,
  playlistId: string,
  name: string,
  description: string
) => {
  const { data } = await axios.put<SpotifyApi.ChangePlaylistDetailsResponse>(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      name,
      description,
      public: null,
    },
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  return data;
};

/**
 * Gets or refreshes a Spotify API token
 * @param request Token request parameters
 * @param client_id Spotify client ID
 * @param client_secret Spotify client secret
 * @returns Token data with expiry time
 */
export const getSpotifyToken = async (
  request: TokenRequest,
  client_id: string,
  client_secret: string
): Promise<TokenData> => {
  if (!client_id || !client_secret) {
    throw new Error("Client ID and Client Secret are required");
  }

  try {
    const requestTimeMs = Date.now();
    const { data } = await axios.post<TokenResponse>(
      "https://accounts.spotify.com/api/token",
      qs.stringify(request),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${client_id}:${client_secret}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!data.access_token) {
      throw new Error("Failed to get token: No access token in response");
    }

    // For refresh token requests, use the new refresh token if provided,
    // otherwise fall back to the existing refresh token
    const refreshToken =
      request.grant_type === "refresh_token"
        ? data.refresh_token ?? request.refresh_token
        : data.refresh_token ?? ""; // Authorization code flow should always provide a refresh token

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    return {
      accessToken: data.access_token,
      refreshToken,
      scope: data.scope,
      expiryTime: requestTimeMs + data.expires_in * 1000,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Failed to get Spotify token: ${
          error.response.status
        } - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(
      `Failed to get Spotify token: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
