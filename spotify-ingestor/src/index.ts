import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { SpotifyNowPlayingEmitter } from "./SpotifyNowPlayingEmitter";
import { computeModule } from "./computeModule";

const spotifyTokenCache = new SelfUpdatingTokenCache(
  computeModule.getCredential("SpotifyApi", "AccessToken"),
  computeModule.getCredential("SpotifyApi", "RefreshToken")
);
const currentMusicEmitter = new SpotifyNowPlayingEmitter(spotifyTokenCache);

/**
 * Writes data to a stream in the Foundry Streaming service
 */
function writeToStream(rid: string, viewRid: string, data: any) {
  if (computeModule.environment.type !== "pipelines") {
    throw new Error("This module is only supported in pipelines");
  }
  const targetUri = `https://${process.env.FOUNDRY_URL}/stream-proxy/api/streams/${rid}/views/${viewRid}/jsonRecords`;
  console.log("POSTING to", targetUri);
  console.log("Data", JSON.stringify(data));
  return fetch(targetUri, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + computeModule.environment.buildToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ value: data }]),
  })
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error("Error:", error));
}

currentMusicEmitter.start();
currentMusicEmitter.on("trackChanged", (trackInformation) => {
  console.log("Track changed", trackInformation.id);
  const nowPlayingResource = computeModule.getResource("now-playing");
  writeToStream(
    nowPlayingResource.rid,
    "ri.foundry-streaming.main.view.8ca99480-ad42-49ac-a634-e84965a28885",
    {
      timestamp: Date.now(),
      track_id: trackInformation.id,
      type: "track",
      progress_ms: trackInformation.currentlyPlaying.progress_ms,
    }
  );

  const trackResource = computeModule.getResource("tracks");
  if (trackResource == null) {
    console.log("No output for track data");
  } else if (trackInformation.currentlyPlaying.item.type === "track") {
    writeToStream(
      trackResource.rid,
      "ri.foundry-streaming.main.view.68205912-6500-4c69-98b1-93a7dad68162",
      {
        id: trackInformation.id,
        name: trackInformation.currentlyPlaying.item.name,
        artists: trackInformation.currentlyPlaying.item.artists.map(
          (artist) => artist.name
        ),
        popularity: trackInformation.currentlyPlaying.item.popularity,
        preview_url: trackInformation.currentlyPlaying.item.preview_url,
        isDeleted: false,
        timestamp: Date.now(),
      }
    );
  }

  const trackFeaturesResource = computeModule.getResource("track-features");
  if (trackFeaturesResource == null) {
    console.log("No output for track features data");
  } else {
    writeToStream(
      trackFeaturesResource.rid,
      "ri.foundry-streaming.main.view.8ff7f33d-c67c-4aab-ae99-7d588743c134",
      {
        id: trackInformation.id,
        danceability: trackInformation.features.danceability,
        energy: trackInformation.features.energy,
        key: trackInformation.features.key,
        loudness: trackInformation.features.loudness,
        mode: trackInformation.features.mode,
        speechiness: trackInformation.features.speechiness,
        acousticness: trackInformation.features.acousticness,
        instrumentalness: trackInformation.features.instrumentalness,
        liveness: trackInformation.features.liveness,
        valence: trackInformation.features.valence,
        tempo: trackInformation.features.tempo,
        duration_ms: trackInformation.features.duration_ms,
        time_signature: trackInformation.features.time_signature,
        timestamp: Date.now(),
        isDeleted: false,
      }
    );
  }
});
