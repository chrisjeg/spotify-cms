import { TypedEmitter } from "tiny-typed-emitter";
import {
  getCurrentlyPlaying,
  getSpotifyAnalysis,
  getSpotifyFeatures,
  getUserPlaylists,
} from "./spotifyApi";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";

export interface TrackInformation {
  id: string;
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse;
  analysis: SpotifyApi.AudioAnalysisResponse;
  features: SpotifyApi.AudioFeaturesResponse;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string;
  snapshot_id: string;
  tracks: {
    total: number;
  };
  owner: {
    id: string;
    display_name: string;
  };
}

interface SpotifyEmitterEvents {
  isPlaying: (isPlaying: boolean) => void;
  trackChanged: (trackInformation: TrackInformation) => void;
  playlistCreated: (playlist: PlaylistInfo) => void;
  playlistModified: (playlist: PlaylistInfo) => void;
  playlistDeleted: (playlistId: PlaylistInfo) => void;
}

export class SpotifyEmitter extends TypedEmitter<SpotifyEmitterEvents> {
  private interval: NodeJS.Timer | undefined;
  private playlistInterval: NodeJS.Timer | undefined;
  private isPlaying = false;
  private trackId = "";
  private hasOutboundRequest: boolean = false;
  private hasOutboundPlaylistRequest: boolean = false;
  private _playlistCache: Map<string, PlaylistInfo> | null = null;

  constructor(
    private tokenCache: SelfUpdatingTokenCache,
    private playlistPollingIntervalMs: number = 5000
  ) {
    super();
  }

  /**
   * Get the current playlist cache
   */
  getPlaylistCache(): Map<string, PlaylistInfo> | null {
    return this._playlistCache;
  }

  start() {
    if (this.interval) {
      console.warn("[CurrentMusicEmitter] Already started");
      return;
    }

    this.interval = setInterval(async () => {
      if (this.hasOutboundRequest) {
        return;
      }
      try {
        this.hasOutboundRequest = true;
        const accessToken = await this.tokenCache.getToken();
        if (accessToken == null) {
          return;
        }
        const currentlyPlaying = await getCurrentlyPlaying(
          accessToken.accessToken
        );

        if (
          currentlyPlaying != null &&
          this.isPlaying !== currentlyPlaying.is_playing
        ) {
          this.isPlaying = currentlyPlaying.is_playing;
          this.emit("isPlaying", this.isPlaying);
        }

        const id = currentlyPlaying?.item?.id;

        if (
          id != null &&
          this.trackId !== id &&
          currentlyPlaying?.currently_playing_type === "track"
        ) {
          this.trackId = id;
          const [analysis, features] = await Promise.all([
            getSpotifyAnalysis(id, accessToken.accessToken),
            getSpotifyFeatures(id, accessToken.accessToken),
          ]);

          this.emit("trackChanged", {
            id,
            analysis,
            currentlyPlaying,
            features,
          } satisfies TrackInformation);
        }
      } catch (e) {
        console.error("[CurrentMusicEmitter] Error updating", e);
      }
      this.hasOutboundRequest = false;
    }, 1000);

    // Start playlist monitoring
    this.startPlaylistMonitoring();

    return this;
  }

  private startPlaylistMonitoring() {
    if (this.playlistInterval) {
      console.warn("[PlaylistMonitor] Already started");
      return;
    }

    // Initial fetch of playlists
    this.pollPlaylists();

    this.playlistInterval = setInterval(() => {
      this.pollPlaylists();
    }, this.playlistPollingIntervalMs);
  }

  private async pollPlaylists() {
    if (this.hasOutboundPlaylistRequest) {
      return;
    }

    try {
      this.hasOutboundPlaylistRequest = true;
      const accessToken = await this.tokenCache.getToken();
      if (!accessToken) {
        return;
      }

      // Get current playlists
      const userPlaylists = await getUserPlaylists(accessToken.accessToken);
      const currentPlaylists = new Map<string, PlaylistInfo>();

      // Process each playlist
      for (const playlist of userPlaylists.items) {
        const playlistInfo: PlaylistInfo = {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description || "",
          snapshot_id: playlist.snapshot_id,
          tracks: {
            total: playlist.tracks.total,
          },
          owner: {
            id: playlist.owner.id,
            display_name: playlist.owner.display_name || playlist.owner.id,
          },
        };

        currentPlaylists.set(playlist.id, playlistInfo);

        if (this._playlistCache != null) {
          // Check if this is a new playlist
          if (!this._playlistCache.has(playlist.id)) {
            this._playlistCache.set(playlist.id, playlistInfo);
            this.emit("playlistCreated", playlistInfo);
          }
          // Check if playlist was modified
          else {
            const cachedPlaylist = this._playlistCache?.get(playlist.id)!;
            if (
              cachedPlaylist?.tracks.total !== playlistInfo.tracks.total ||
              cachedPlaylist?.name !== playlistInfo.name ||
              cachedPlaylist?.description !== playlistInfo.description
            ) {
              this._playlistCache.set(playlist.id, playlistInfo);
              this.emit("playlistModified", playlistInfo);
            }
          }
        }
      }

      // Check for deleted playlists
      if (this._playlistCache != null) {
        for (const [id, info] of this._playlistCache.entries()) {
          if (!currentPlaylists.has(id)) {
            this._playlistCache.delete(id);
            this.emit("playlistDeleted", info);
          }
        }
      }

      if (this._playlistCache == null) {
        this._playlistCache = currentPlaylists;
      }
    } catch (e) {
      console.error("[PlaylistMonitor] Error updating playlists", e);
    }

    this.hasOutboundPlaylistRequest = false;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval as any);
      this.interval = undefined;
    }

    if (this.playlistInterval) {
      clearInterval(this.playlistInterval as any);
      this.playlistInterval = undefined;
    }
  }
}
