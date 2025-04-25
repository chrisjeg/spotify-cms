import { Client, Osdk } from "@osdk/client";
import { SpotifyPlaylistTrack } from "@spotify-compute-module/sdk";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { BaseSpotifyOntologySubscription } from "./SpotifyPlaylistOntologySubscription";
import * as Spotify from "./spotifyApi";

// Interface for track cache entries
interface TrackCacheEntry {
  playlistId: string;
  trackUri: string;
}

// Specialized class for Spotify playlist tracks subscriptions
export class SpotifyPlaylistTrackOntologySubscription extends BaseSpotifyOntologySubscription<SpotifyPlaylistTrack> {
  // Track cache to batch operations
  private trackCache: Map<string, Osdk.Instance<SpotifyPlaylistTrack>[]> =
    new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 1000; // Flush every second

  constructor(client: Client, spotifyTokenCache: SelfUpdatingTokenCache) {
    super(client, spotifyTokenCache, "Spotify playlist track subscription");
    this.setupFlushInterval();
  }

  // Set up the flush interval
  private setupFlushInterval() {
    this.flushInterval = setInterval(
      () => this.flushCache(),
      this.FLUSH_INTERVAL_MS
    );
  }

  // Clear the flush interval
  private clearFlushInterval() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // Implementation of the subscription creation
  protected subscribe() {
    this.clearReconnectTimer();

    console.log(`Setting up ${this.logPrefix}`);
    this.subscriptionActive = true;

    this.subscription = this.client(SpotifyPlaylistTrack).subscribe({
      onChange: async (event) => {
        console.log(event);
        if (event.state === "ADDED_OR_UPDATED") {
          console.log(
            "Playlist track added or updated in Spotify",
            event.object
          );

          try {
            // Extract track info from event
            const playlistId = event.object.playlistId;

            // Add to cache instead of directly adding to playlist
            this.addToCache(playlistId, event.object);
          } catch (error) {
            console.error("Error handling playlist track change:", error);
          }
        }
      },
      onSuccessfulSubscription: () => {
        console.log(`${this.logPrefix} established successfully`);
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      },
      onOutOfDate: () => {
        console.log(`${this.logPrefix} data is out of date`);
      },
      onError: (errors) => {
        console.error(`${this.logPrefix} error:`, errors);

        if (errors.subscriptionClosed) {
          console.log("Subscription was closed, attempting to reconnect...");
          this.subscriptionActive = false;

          const reconnectDelay = this.getReconnectDelay();
          console.log(
            `Will attempt to reconnect in ${reconnectDelay}ms (attempt #${this.reconnectAttempts})`
          );

          // Schedule reconnect with exponential backoff
          this.reconnectTimeout = setTimeout(() => {
            if (!this.subscriptionActive) {
              this.subscribe();
            }
          }, reconnectDelay);
        }
      },
    });

    return this.subscription;
  }

  // Override unsubscribe to also clear the flush interval
  public unsubscribe() {
    this.clearFlushInterval();
    // Force a final flush when unsubscribing
    this.flushCache();
    super.unsubscribe();
  }

  // Add track to the internal cache
  private addToCache(
    playlistId: string,
    track: Osdk.Instance<SpotifyPlaylistTrack>
  ) {
    if (!this.trackCache.has(playlistId)) {
      this.trackCache.set(playlistId, []);
    }

    const tracks = this.trackCache.get(playlistId);
    const existingIndex = tracks?.findIndex(
      (entry) => entry.$primaryKey === track.$primaryKey
    );
    if (existingIndex !== undefined && existingIndex >= 0) {
      tracks[existingIndex] = track; // Update existing track
    } else {
      tracks?.push(track); // Add new track
    }
  }

  // Flush the cache and make actual API calls
  private async flushCache() {
    if (this.trackCache.size === 0) {
      return; // Nothing to flush
    }

    try {
      const token = await this.spotifyTokenCache.getToken();

      // For each playlist, process all its tracks in one call
      for (const [playlistId, tracks] of this.trackCache.entries()) {
        // Bail if no tracks
        if (tracks.length === 0) {
          continue;
        }

        // Load the playlist ID from Spotify
        const playlistInfo = await Spotify.getTracksFromPlaylist(
          token.accessToken,
          playlistId
        );
        if (!playlistInfo) {
          console.error(`Playlist ${playlistId} not found on Spotify`);
          continue;
        }
        // Check if tracks are already in the playlist
        const existingTracks = playlistInfo.items.map((item) => item.track.uri);
        const newTracks = new Set(tracks.map((track) => track.songId));
        const tracksToAdd = tracks.filter(
          (track) => !existingTracks.includes(track.songId)
        );
        if (tracksToAdd.length === 0) {
          console.log(
            `No new tracks to add for playlist ${playlistId}, skipping flush`
          );
          continue;
        }
        // Add the new tracks to the playlist
        await Spotify.addTracksToPlaylist(
          token.accessToken,
          playlistId,
          tracksToAdd.map((track) => track.songId)
        );

        console.log(
          `Flushed ${tracks.length} tracks for playlist ${playlistId}`
        );
      }

      // Clear the cache after processing
      this.trackCache.clear();
    } catch (error) {
      console.error("Error flushing track cache:", error);
    }
  }
}
