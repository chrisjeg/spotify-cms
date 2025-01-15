import axios from "axios";
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

export const createPlaylist = async (
  accessToken: string,
  userId: string,
  name: string,
  description: string
) => {
  const { data } = await axios.post<SpotifyApi.CreatePlaylistResponse>(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      name,
      description,
    },
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  return data;
};

export const addTracksToPlaylist = async (
  accessToken: string,
  playlistId: string,
  uris: string[],
  position: number = 0
) => {
  const { data } = await axios.post<SpotifyApi.AddTracksToPlaylistResponse>(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      uris,
      position,
    },
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  return data;
};

export const getCurrentlyPlaying = async (accessToken: string) => {
  const { data } = await axios.get<SpotifyApi.CurrentlyPlayingResponse>(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );
  return data;
};

export const getSpotifyFeatures = async (
  trackId: string,
  accessToken: string
) => {
  const { data } = await axios.get<SpotifyApi.AudioFeaturesResponse>(
    "https://api.spotify.com/v1/audio-features/" + trackId,
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  return data;
};

export const getSpotifyAnalysis = async (
  trackId: string,
  accessToken: string
) => {
  const { data } = await axios.get<SpotifyApi.AudioAnalysisResponse>(
    "https://api.spotify.com/v1/audio-analysis/" + trackId,
    {
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  );

  return data;
};

type TokenRequest =
  | {
      grant_type: "refresh_token";
      refresh_token: string;
    }
  | {
      grant_type: "authorization_code";
      code: string;
      redirect_uri: string;
    };

interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number; //seconds
  refresh_token?: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiryTime: number;
  scope: string;
}

export const getSpotifyToken = async (
  request: TokenRequest,
  client_id: string,
  client_secret: string
): Promise<TokenData> => {
  const requestTimeMs = Date.now();
  const { data } = await axios.post<TokenResponse>(
    "https://accounts.spotify.com/api/token",
    qs.stringify(request),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(client_id + ":" + client_secret).toString("base64"),
        ["Content-Type"]: "application/x-www-form-urlencoded",
      },
    }
  );

  if (data.access_token == null) {
    throw new Error("Failed to get token");
  }

  return {
    accessToken: data.access_token,
    refreshToken:
      request.grant_type === "refresh_token"
        ? data.refresh_token ?? request.refresh_token
        : data.refresh_token,
    scope: data.scope,
    expiryTime: requestTimeMs + data.expires_in * 1000,
  };
};
