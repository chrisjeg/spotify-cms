import { TypedEmitter } from "tiny-typed-emitter";
import {
  getCurrentlyPlaying,
  getSpotifyAnalysis,
  getSpotifyFeatures,
  Section,
} from "./spotifyApi";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";

export interface TrackInformation {
  id: string;
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse;
  analysis: SpotifyApi.AudioAnalysisResponse;
  features: SpotifyApi.AudioFeaturesResponse;
}
interface SpotifyNowPlayingEvents {
  isPlaying: (isPlaying: boolean) => void;
  trackChanged: (trackInformation: TrackInformation) => void;
}

export class SpotifyNowPlayingEmitter extends TypedEmitter<SpotifyNowPlayingEvents> {
  private interval: NodeJS.Timer | undefined;
  private isPlaying = false;
  private trackId = "";
  private hasOutboundRequest: boolean;

  constructor(private tokenCache: SelfUpdatingTokenCache) {
    super();
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

        if (this.isPlaying !== currentlyPlaying.is_playing) {
          this.isPlaying = currentlyPlaying.is_playing;
          this.emit("isPlaying", this.isPlaying);
        }

        const id = currentlyPlaying.item?.id;

        if (
          id != null &&
          this.trackId !== id &&
          currentlyPlaying.currently_playing_type === "track"
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

    return this;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval as any);
      this.interval = undefined;
    }
  }
}
