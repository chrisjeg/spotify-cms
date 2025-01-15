import { Type } from "@sinclair/typebox";
import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { addTracksToPlaylist, createPlaylist } from "./spotifyApi";
import { ComputeModule } from "@palantir/compute-module";

const computeModule = new ComputeModule({
  logger: console,
  sources: {
    SpotifyApi: {
      credentials: ["RefreshToken", "AccessToken", "ClientId", "ClientSecret"],
    },
  },
  definitions: {
    createPlaylist: {
      input: Type.Object({
        userId: Type.String(),
        name: Type.String(),
        description: Type.String(),
      }),
      output: Type.Object({
        id: Type.String(),
      }),
    },
    addTracksToPlaylist: {
      input: Type.Object({
        playlistId: Type.String(),
        uris: Type.Array(Type.String()),
      }),
      output: Type.Object({
        snapshot_id: Type.String(),
      }),
    },
  },
});

const spotifyTokenCache = new SelfUpdatingTokenCache(
  computeModule.getCredential("SpotifyApi", "AccessToken"),
  computeModule.getCredential("SpotifyApi", "RefreshToken")
);

computeModule
  .register("createPlaylist", async (input) => {
    const token = await spotifyTokenCache.getToken(
      computeModule.getCredential("SpotifyApi", "ClientId"),
      computeModule.getCredential("SpotifyApi", "ClientSecret")
    );
    console.log("Creating playlist with input", input);
    return createPlaylist(
      token.accessToken,
      input.userId,
      input.name,
      input.description
    );
  })
  .register("addTracksToPlaylist", async (input) => {
    const token = await spotifyTokenCache.getToken(
      computeModule.getCredential("SpotifyApi", "ClientId"),
      computeModule.getCredential("SpotifyApi", "ClientSecret")
    );
    console.log("Adding tracks to playlist with input", input);
    return addTracksToPlaylist(token.accessToken, input.playlistId, input.uris);
  });
