import { computeModule } from "./computeModule";
import { getSpotifyToken, TokenData } from "./spotifyApi";

export class SelfUpdatingTokenCache {
  private token: TokenData;

  constructor(
    initialAccessToken: string,
    initialRefreshToken: string,
    scope = "user-read-currently-playing"
  ) {
    this.token = {
      accessToken: initialAccessToken,
      expiryTime: Date.now(),
      refreshToken: initialRefreshToken,
      scope,
    };
  }

  public async getToken(): Promise<TokenData> {
    const userTokenInfo: TokenData | undefined = this.token;

    if (userTokenInfo == null || userTokenInfo.expiryTime < Date.now()) {
      console.log("Refreshing token");
      const tokenResponse = await getSpotifyToken(
        {
          grant_type: "refresh_token",
          refresh_token: userTokenInfo.refreshToken,
        },
        computeModule.getCredential("SpotifyApi", "ClientId"),
        computeModule.getCredential("SpotifyApi", "ClientSecret")
      );
      this.token = tokenResponse;
      return tokenResponse;
    } else {
      return userTokenInfo;
    }
  }
}
