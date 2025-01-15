import express from "express";
import { getSpotifyToken } from "./spotifyApi";

// Lazy OAuth2 for Spotify
const app = express();
let state = crypto.randomUUID();
app
  .get("/", (_req, res) => {
    const scope =
      "user-read-currently-playing playlist-read-private user-top-read playlist-modify-private";

    // Make a query string using native Node.js modules
    const query = new URLSearchParams({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: "http://localhost:8888/auth/callback",
      state,
    });

    res.redirect("https://accounts.spotify.com/authorize?" + query.toString());
  })
  .get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (req.query.state !== state) {
      return res.status(400).send("Invalid state");
    }
    const accessToken = await getSpotifyToken(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost:8888/auth/callback",
      },
      process.env.SPOTIFY_CLIENT_ID,
      process.env.SPOTIFY_CLIENT_SECRET
    );
    console.log(accessToken);
    res.send("Authenticated!");
  })
  .listen(8888);
