import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { SpotifyEmitter, PlaylistInfo } from "./SpotifyNowPlayingEmitter";
import { computeModule, developGetCredential } from "./computeModule";

const accessToken = developGetCredential("SpotifyApi", "AccessToken");
const refreshToken = developGetCredential("SpotifyApi", "RefreshToken");
const clientId = developGetCredential("SpotifyApi", "ClientId");
const clientSecret = developGetCredential("SpotifyApi", "ClientSecret");

if (!clientId || !clientSecret) {
  throw new Error(
    "Spotify API client credentials are not set. Please set the ClientId and ClientSecret credentials in the environment."
  );
}

if (!accessToken || !refreshToken) {
  throw new Error(
    "Spotify API credentials are not set. Please set the AccessToken and RefreshToken credentials in the environment."
  );
}

const spotifyTokenCache = new SelfUpdatingTokenCache(
  accessToken,
  refreshToken,
  clientId,
  clientSecret,
  "user-read-currently-playing "
);
const currentMusicEmitter = new SpotifyEmitter(spotifyTokenCache);

currentMusicEmitter.start();
currentMusicEmitter.on("trackChanged", (trackInformation) => {
  console.log("Track changed", trackInformation.id);
  const nowPlayingResource = computeModule?.getResource("now-playing");
  if (nowPlayingResource != null) {
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
  }

  const trackResource = computeModule?.getResource("tracks");
  if (trackResource == null) {
    console.log("No output for track data");
  } else if (trackInformation.currentlyPlaying.item?.type === "track") {
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

  const trackFeaturesResource = computeModule?.getResource("track-features");
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

currentMusicEmitter.on("playlistCreated", (playlist: PlaylistInfo) => {
  console.log(
    `Playlist created: ${playlist.name} (${playlist.id}) with ${playlist.tracks.total} tracks`
  );
  const row = {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    snapshot_id: playlist.snapshot_id,
    tracks_total: playlist.tracks.total,
    owner_id: playlist.owner.id,
    owner_name: playlist.owner.display_name,
    lastModified: Date.now(),
    isDeleted: false,
    operation: "INSERT", // Optional metadata about the operation type
  };
  console.log("Row to be sent:", JSON.stringify(row, null, 2));

  const playlistResource = computeModule?.getResource("playlists");
  if (playlistResource) {
    writeToStream(
      playlistResource.rid,
      "ri.foundry-streaming.main.view.dfc9bad2-0e60-461c-8bbe-8023aa251c96", // Replace with your actual view RID
      row
    );
  }
});

currentMusicEmitter.on("playlistModified", (playlist: PlaylistInfo) => {
  console.log(`Playlist modified: ${playlist.name} (${playlist.id})`);
  const row = {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    snapshot_id: playlist.snapshot_id,
    tracks_total: playlist.tracks.total,
    owner_id: playlist.owner.id,
    owner_name: playlist.owner.display_name,
    lastModified: Date.now(),
    isDeleted: false,
    operation: "UPDATE", // Optional metadata about the operation type
  };
  console.log("Row to be sent:", JSON.stringify(row, null, 2));

  const playlistResource = computeModule?.getResource("playlists");
  if (playlistResource) {
    writeToStream(
      playlistResource.rid,
      "ri.foundry-streaming.main.view.dfc9bad2-0e60-461c-8bbe-8023aa251c96", // Replace with your actual view RID
      row
    );
  }
});

currentMusicEmitter.on("playlistDeleted", (playlist: PlaylistInfo) => {
  console.log(`Playlist deleted: ${playlist.name} (${playlist.id})`);

  const playlistResource = computeModule?.getResource("playlists");
  if (playlistResource) {
    writeToStream(
      playlistResource.rid,
      "ri.foundry-streaming.main.view.dfc9bad2-0e60-461c-8bbe-8023aa251c96",
      {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        snapshot_id: playlist.snapshot_id,
        tracks_total: playlist.tracks.total,
        owner_id: playlist.owner.id,
        owner_name: playlist.owner.display_name,
        lastModified: Date.now(),
        isDeleted: true,
        operation: "DELETE", // Optional metadata about the operation type
      }
    );
  }
});

/**
 * Writes data to a stream in the Foundry Streaming service
 */
function writeToStream(rid: string, viewRid: string, data: any) {
  // For local development, just log the data that would be sent to the stream
  if (
    process.env.NODE_ENV === "development" ||
    computeModule?.environment.type !== "pipelines"
  ) {
    console.log("Local development: Data that would be sent to stream:");
    console.log(`Stream RID: ${rid}, View RID: ${viewRid}`);
    console.log("Data:", JSON.stringify(data, null, 2));
    return Promise.resolve({ success: true, local: true });
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
