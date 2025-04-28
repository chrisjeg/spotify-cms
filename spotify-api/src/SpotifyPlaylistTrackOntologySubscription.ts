import { Client, Osdk } from "@osdk/client";
import { SpotifyPlaylistTrack } from "@spotify-compute-module/sdk";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { BaseSpotifyOntologySubscription } from "./SpotifyPlaylistOntologySubscription";
import * as Spotify from "./spotifyApi";

// Track operation types for tracking state
enum TrackOperation {
  ADD,
  DELETE,
}

// Track entry with operation type
interface TrackEntry {
  track: Osdk.Instance<SpotifyPlaylistTrack>;
  operation: TrackOperation;
}

export class SpotifyPlaylistTrackOntologySubscription extends BaseSpotifyOntologySubscription<SpotifyPlaylistTrack> {
  private operationsCache: Map<string, Map<string, TrackEntry>> = new Map();
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
        console.log(
          `Playlist track event detected for playlist ${JSON.stringify(
            event.object
          )}`
        );
        try {
          // Extract track info from event
          const playlistId = event.object.playlistId;

          if (event.state === "ADDED_OR_UPDATED") {
            console.log(
              "Playlist track added or updated in Foundry",
              event.object
            );

            // Record as an addition
            this.addToOperationsCache(
              playlistId,
              event.object,
              TrackOperation.ADD
            );
          } else if (event.state === "REMOVED") {
            console.log("Playlist track deletion detected", event.object);

            // Record as a deletion
            this.addToOperationsCache(
              playlistId,
              event.object,
              TrackOperation.DELETE
            );
          }
        } catch (error) {
          console.error("Error handling playlist track event:", error);
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

  // Add track to operations cache with proper operation type
  private addToOperationsCache(
    playlistId: string,
    track: Osdk.Instance<SpotifyPlaylistTrack>,
    operation: TrackOperation
  ) {
    // Create playlist entry in cache if it doesn't exist
    if (!this.operationsCache.has(playlistId)) {
      this.operationsCache.set(playlistId, new Map());
    }

    const playlistTracks = this.operationsCache.get(playlistId)!;
    const trackKey = track.$primaryKey;

    // If this track already has an operation in the cache:
    if (playlistTracks.has(trackKey)) {
      const currentOperation = playlistTracks.get(trackKey)!.operation;

      // Special case: If a track was marked for deletion and now is being added back,
      // update it to be an addition
      if (
        currentOperation === TrackOperation.DELETE &&
        operation === TrackOperation.ADD
      ) {
        console.log(
          `Track ${trackKey} was previously marked for deletion but is now being re-added`
        );
        playlistTracks.set(trackKey, { track, operation: TrackOperation.ADD });
      }
      // If a track was added and now is being deleted, just delete it from our operations
      // as there's no need to add then delete
      else if (
        currentOperation === TrackOperation.ADD &&
        operation === TrackOperation.DELETE
      ) {
        console.log(
          `Track ${trackKey} was pending addition but is now deleted - removing from operations`
        );
        playlistTracks.delete(trackKey);
      }
      // Otherwise update with the latest operation (shouldn't happen often)
      else {
        playlistTracks.set(trackKey, { track, operation });
      }
    }
    // Otherwise, just add the track with its operation
    else {
      playlistTracks.set(trackKey, { track, operation });
    }
  }

  // Flush the cache and make actual API calls
  private async flushCache() {
    if (this.operationsCache.size === 0) {
      return; // Nothing to process
    }

    console.log(
      "Flushing operations cache",
      JSON.stringify(this.operationsCache)
    );

    try {
      const token = await this.spotifyTokenCache.getToken();

      // For each playlist, process all its tracks operations
      for (const [
        playlistId,
        operationsMap,
      ] of this.operationsCache.entries()) {
        // Skip empty playlists
        if (operationsMap.size === 0) {
          continue;
        }

        // Load the playlist ID from Spotify to get the name
        const playlistInfo = await Spotify.getPlaylistDetails(
          playlistId,
          token.accessToken
        );

        if (
          !playlistInfo ||
          !playlistInfo.name.toLocaleLowerCase().includes("aip")
        ) {
          console.log("Playlist name does not include 'aip', skipping update");
          continue;
        }

        // Group tracks by operation type
        const tracksToAdd: Osdk.Instance<SpotifyPlaylistTrack>[] = [];
        const tracksToDelete: Osdk.Instance<SpotifyPlaylistTrack>[] = [];

        for (const [_, entry] of operationsMap.entries()) {
          if (entry.operation === TrackOperation.ADD) {
            tracksToAdd.push(entry.track);
          } else {
            tracksToDelete.push(entry.track);
          }
        }

        // Process additions if needed
        if (tracksToAdd.length > 0) {
          await this.processAdditions(
            token.accessToken,
            playlistId,
            tracksToAdd
          );
        }

        // Process deletions if needed
        if (tracksToDelete.length > 0) {
          await this.processDeletions(
            token.accessToken,
            playlistId,
            tracksToDelete
          );
        }
      }

      // Clear the operations cache after processing
      this.operationsCache.clear();
    } catch (error) {
      console.error("Error flushing operations cache:", error);
    }
  }

  // Process track additions for a specific playlist
  private async processAdditions(
    accessToken: string,
    playlistId: string,
    tracks: Osdk.Instance<SpotifyPlaylistTrack>[]
  ) {
    // Load the playlist ID from Spotify
    const playlistInfo = await Spotify.getTracksFromPlaylist(
      accessToken,
      playlistId
    );

    if (!playlistInfo) {
      console.error(`Playlist ${playlistId} not found on Spotify`);
      return;
    }

    // Check if tracks are already in the playlist
    const existingTracks = playlistInfo.items.map((item) => item.track.uri);
    const tracksToAdd = tracks.filter(
      (track) => !existingTracks.includes(`spotify:track:${track.songId}`)
    );

    if (tracksToAdd.length === 0) {
      console.log(
        `No new tracks to add for playlist ${playlistId}, skipping addition`
      );
      return;
    }

    // Add the new tracks to the playlist
    await Spotify.addTracksToPlaylist(
      accessToken,
      playlistId,
      tracksToAdd.map((track) => `spotify:track:${track.songId}`)
    );

    console.log(`Added ${tracksToAdd.length} tracks to playlist ${playlistId}`);
  }

  // Process track deletions for a specific playlist
  private async processDeletions(
    accessToken: string,
    playlistId: string,
    tracks: Osdk.Instance<SpotifyPlaylistTrack>[]
  ) {
    if (tracks.length === 0) {
      return;
    }

    console.log(
      `Processing ${tracks.length} track deletions for playlist ${playlistId}`
    );

    // Remove the tracks from the playlist
    await Spotify.removeTracksFromPlaylist(
      accessToken,
      playlistId,
      tracks.map((track) => `spotify:track:${track.songId}`)
    );

    console.log(`Removed ${tracks.length} tracks from playlist ${playlistId}`);
  }
}
