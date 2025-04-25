import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { developGetCredential } from "./computeModule";
import { PlaylistInfo, SpotifyEmitter } from "./SpotifyNowPlayingEmitter";
import { Client, createClient, isOk, Osdk } from "@osdk/client";
import {
  createNewSpotifyPlaylist,
  deleteSpotifyPlaylist,
  modifySpotifyPlaylist,
  SpotifyPlaylist,
} from "@spotify-compute-module/sdk";
import { createConfidentialOauthClient } from "@osdk/oauth";
import * as Spotify from "./spotifyApi";

const accessToken = developGetCredential("SpotifyApi", "AccessToken");
const refreshToken = developGetCredential("SpotifyApi", "RefreshToken");
const clientId = developGetCredential("SpotifyApi", "ClientId");
const clientSecret = developGetCredential("SpotifyApi", "ClientSecret");

const auth = createConfidentialOauthClient(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.FOUNDRY_URL
);
const client: Client = createClient(
  process.env.FOUNDRY_URL,
  "ri.ontology.main.ontology.f4c9683b-84d8-4909-af34-a1508e79b133",
  auth
);

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

client(SpotifyPlaylist).subscribe({
  onChange: async (event) => {
    console.log(event);
    if (event.state === "ADDED_OR_UPDATED") {
      const playlistCache = currentMusicEmitter.getPlaylistCache();
      if (playlistCache == null) {
        console.log("Playlist cache is null, skipping update");
        return;
      }
      const playlistInfo = playlistCache?.get(event.object.playlistId);
      if (playlistInfo == null) {
        const token = await spotifyTokenCache.getToken();
        console.log("Creating new playlist", event.object);
        // await Spotify.createPlaylist(
        //   token.accessToken,
        //   event.object.owner,
        //   event.object.name,
        //   event.object.description
        // );
      } else if (!objectMatchesPlaylist(event.object, playlistInfo)) {
        const token = await spotifyTokenCache.getToken();
        await Spotify.modifyPlaylistDetails(
          token.accessToken,
          event.object.playlistId,
          event.object.name,
          event.object.description
        );
      }
    }
  },
});

currentMusicEmitter
  .addListener("playlistCreated", async (playlistInfo) => {
    console.log("Playlist created", playlistInfo.id);

    const result = await client(SpotifyPlaylist).fetchOneWithErrors(
      playlistInfo.id
    );
    if (isOk(result)) {
      console.log("Playlist already exists", playlistInfo.id);
      await modifyPlaylistInFoundry({
        spotify_playlist: result.value.playlistId,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total + "",
      });
    } else {
      console.log("Creating a new playlist", playlistInfo.id);
      createNewPlaylistInFoundry({
        playlist_id: playlistInfo.id,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total,
      });
    }
  })
  .addListener("playlistModified", async (playlistInfo) => {
    console.log("Playlist modified", playlistInfo.id);

    const result = await client(SpotifyPlaylist).fetchOneWithErrors(
      playlistInfo.id
    );
    if (isOk(result)) {
      await modifyPlaylistInFoundry({
        spotify_playlist: result.value.playlistId,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total + "",
      });
    } else {
      console.error(
        "Failed to find playlist to update - creating a new one",
        playlistInfo.id
      );
      await createNewPlaylistInFoundry({
        playlist_id: playlistInfo.id,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total,
      });
    }
  })
  .addListener("playlistDeleted", (playlistInfo) => {
    console.log("Playlist deleted", playlistInfo.id);
    deletePlaylistInFoundry(playlistInfo.id);
  })
  .start();

async function createNewPlaylistInFoundry(
  playlistInfo: createNewSpotifyPlaylist.Params
) {
  try {
    await client(createNewSpotifyPlaylist).applyAction(playlistInfo);
    console.log("New playlist created", playlistInfo);
  } catch (e) {
    console.error("Failed to create new playlist", e, playlistInfo);
  }
}

async function modifyPlaylistInFoundry(
  playlistInfo: modifySpotifyPlaylist.Params
) {
  try {
    const response = await client(modifySpotifyPlaylist).applyAction(
      playlistInfo,
      {
        $returnEdits: true,
      }
    );
    console.log("Playlist modified", playlistInfo, response);
  } catch (e) {
    console.error("Failed to modify playlist", e, playlistInfo);
  }
}

async function deletePlaylistInFoundry(id: string) {
  try {
    await client(deleteSpotifyPlaylist).applyAction({
      spotify_playlist: id,
    });
    console.log("Playlist deleted", id);
  } catch (e) {
    console.error("Failed to delete playlist", e, id);
  }
}

function objectMatchesPlaylist(
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
