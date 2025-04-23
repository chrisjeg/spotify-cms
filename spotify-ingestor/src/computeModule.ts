// Load environment variables from .env file in development
import * as dotenv from "dotenv";
import { ComputeModule } from "@palantir/compute-module";

// Load .env file if not in a pipeline environment
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: ".env.development" });
}

export let computeModule: ComputeModule<any> | undefined = undefined;
try {
  computeModule = new ComputeModule({
    logger: console,
    sources: {
      SpotifyApi: {
        credentials: [
          "RefreshToken",
          "AccessToken",
          "ClientId",
          "ClientSecret",
        ],
      },
    },
  });
} catch (e) {
  console.error("Error initializing ComputeModule:", e);
  computeModule = undefined;
}

export const developGetCredential = (source: string, credential: string) => {
  // If we're running locally and the value is not available from ComputeModule, try environment variables
  if (process.env.NODE_ENV === "development") {
    if (source === "SpotifyApi") {
      switch (credential) {
        case "AccessToken":
          return process.env.SPOTIFY_ACCESS_TOKEN || "";
        case "RefreshToken":
          return process.env.SPOTIFY_REFRESH_TOKEN || "";
        case "ClientId":
          return process.env.SPOTIFY_CLIENT_ID || "";
        case "ClientSecret":
          return process.env.SPOTIFY_CLIENT_SECRET || "";
      }
    }
  }

  return computeModule?.getCredential(source, credential);
};
