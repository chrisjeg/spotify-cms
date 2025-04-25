import { Client, Osdk } from "@osdk/client";
import { SpotifyPlaylist } from "@spotify-compute-module/sdk";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { PlaylistInfo } from "./SpotifyNowPlayingEmitter";
import * as Spotify from "./spotifyApi";

// Abstract base class for Spotify ontology subscriptions
export abstract class BaseSpotifyOntologySubscription<T> {
  protected subscriptionActive = false;
  protected reconnectTimeout: NodeJS.Timeout | null = null;
  protected refreshInterval: NodeJS.Timeout | null = null;
  protected readonly MAX_RECONNECT_DELAY_MS = 30000; // Maximum reconnect delay of 30 seconds
  protected readonly REFRESH_INTERVAL_MS = 120000; // Refresh subscription every 2 minutes
  protected reconnectAttempts = 0;
  protected subscription: { unsubscribe: () => void } | null = null;

  constructor(
    protected client: Client,
    protected spotifyTokenCache: SelfUpdatingTokenCache,
    protected logPrefix: string = "Spotify subscription"
  ) {}

  // Calculate reconnect delay with exponential backoff
  protected getReconnectDelay() {
    const baseDelay = 1000; // Start with 1 second
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;
    return delay;
  }

  // Clear any existing reconnect timer
  protected clearReconnectTimer() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Clear the refresh interval
  protected clearRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Start the subscription
  public start() {
    // Initial subscription setup
    this.subscribe();

    // Setup periodic refresh
    this.setupPeriodicRefresh();

    return this;
  }

  // Setup periodic refresh of the subscription
  protected setupPeriodicRefresh() {
    this.clearRefreshInterval();

    this.refreshInterval = setInterval(() => {
      console.log(`${this.logPrefix}: Performing scheduled refresh`);
      this.refreshSubscription();
    }, this.REFRESH_INTERVAL_MS);
  }

  // Refresh the subscription
  protected refreshSubscription() {
    if (this.subscription) {
      console.log(`${this.logPrefix}: Unsubscribing for refresh`);
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.subscriptionActive = false;
    this.subscribe();
  }

  // Unsubscribe and clean up
  public unsubscribe() {
    this.clearReconnectTimer();
    this.clearRefreshInterval();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.subscriptionActive = false;
  }

  // Abstract methods to be implemented by derived classes
  protected abstract subscribe(): { unsubscribe: () => void } | null;
}

// Specialized class for Spotify playlist subscriptions
export class SpotifyPlaylistOntologySubscription extends BaseSpotifyOntologySubscription<SpotifyPlaylist> {
  constructor(
    client: Client,
    spotifyTokenCache: SelfUpdatingTokenCache,
    private currentMusicEmitter: any
  ) {
    super(client, spotifyTokenCache, "Spotify playlist subscription");
  }

  // Implementation of the subscription creation
  protected subscribe() {
    this.clearReconnectTimer();

    console.log(`Setting up ${this.logPrefix}`);
    this.subscriptionActive = true;

    this.subscription = this.client(SpotifyPlaylist).subscribe({
      onChange: async (event) => this.handleChange(event),
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

  // Handling playlist changes
  private async handleChange(event: any) {
    console.log(event);
    if (event.state === "ADDED_OR_UPDATED") {
      console.log("Playlist added or updated in Spotify", event.object);

      const playlistCache = this.currentMusicEmitter.getPlaylistCache();
      if (playlistCache == null) {
        console.log("Playlist cache is null, skipping update");
        return;
      }
      const playlistInfo = playlistCache?.get(event.object.playlistId);

      if (playlistInfo == null) {
        const token = await this.spotifyTokenCache.getToken();
        console.log(
          "Playlist not in cache - creating new playlist",
          event.object
        );
        await Spotify.createPlaylist(
          token.accessToken,
          event.object.owner,
          event.object.name,
          event.object.description
        );
      } else {
        const playlistMatchesCache = this.objectMatchesPlaylist(
          event.object,
          playlistInfo
        );
        if (playlistMatchesCache) {
          console.log("Playlist matches cache, skipping update", event.object);
          return;
        }
        console.log("Playlist does not match cache - modifying playlist", {
          event,
          playlistInfo,
        });
        const token = await this.spotifyTokenCache.getToken();
        await Spotify.modifyPlaylistDetails(
          token.accessToken,
          event.object.playlistId,
          event.object.name,
          event.object.description
        );
      }
    }
  }

  // Helper function to check if object matches playlist
  private objectMatchesPlaylist(
    object: Osdk.Instance<SpotifyPlaylist>,
    playlistInfo: PlaylistInfo
  ) {
    return (
      object.name === playlistInfo.name &&
      object.description === playlistInfo.description &&
      object.owner === playlistInfo.owner.id &&
      object.tracksCount === `${playlistInfo.tracks.total}`
    );
  }
}
