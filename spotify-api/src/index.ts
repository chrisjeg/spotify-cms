import { SelfUpdatingTokenCache } from "./SpotifyTokenCache";
import { developGetCredential } from "./computeModule";
import { SpotifyEmitter } from "./SpotifyNowPlayingEmitter";
import { Client, createClient } from "@osdk/client";
import { createConfidentialOauthClient } from "@osdk/oauth";
import { SpotifyPlaylistOntologySubscription } from "./SpotifyPlaylistOntologySubscription";
import { SpotifyPlaylistTrackOntologySubscription } from "./SpotifyPlaylistTrackOntologySubscription";
import { FoundryPlaylistOperations } from "./FoundryPlaylistOperations";
// Import the console wrapper to enable version prepending
import "./console";

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
const foundryPlaylistOps = new FoundryPlaylistOperations(client);

// Initialize the playlist subscription
const spotifyPlaylistSubscription = new SpotifyPlaylistOntologySubscription(
  client,
  spotifyTokenCache,
  currentMusicEmitter
).start();

// Initialize the playlist track subscription
const spotifyPlaylistTrackSubscription =
  new SpotifyPlaylistTrackOntologySubscription(
    client,
    spotifyTokenCache
  ).start();

// Set up event listeners for the music emitter
currentMusicEmitter
  .addListener("playlistCreated", (playlistInfo) => {
    foundryPlaylistOps.handlePlaylistCreated(playlistInfo);
  })
  .addListener("playlistModified", (playlistInfo) => {
    foundryPlaylistOps.handlePlaylistModified(playlistInfo);
  })
  .addListener("playlistDeleted", (playlistInfo) => {
    foundryPlaylistOps.handlePlaylistDeleted(playlistInfo);
  })
  .start();

// Add a graceful shutdown handler
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down subscriptions...");
  spotifyPlaylistSubscription.unsubscribe();
  spotifyPlaylistTrackSubscription.unsubscribe();
  currentMusicEmitter.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down subscriptions...");
  spotifyPlaylistSubscription.unsubscribe();
  spotifyPlaylistTrackSubscription.unsubscribe();
  currentMusicEmitter.stop();
  process.exit(0);
});
