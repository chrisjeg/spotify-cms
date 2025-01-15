import { ComputeModule } from "@palantir/compute-module";

export const computeModule = new ComputeModule({
  logger: console,
  sources: {
    SpotifyApi: {
      credentials: ["RefreshToken", "AccessToken", "ClientId", "ClientSecret"],
    },
  },
});
