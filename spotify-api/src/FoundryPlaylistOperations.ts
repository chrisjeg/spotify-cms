import { Client, isOk } from "@osdk/client";
import {
  createNewSpotifyPlaylist,
  deleteSpotifyPlaylist,
  modifySpotifyPlaylist,
  SpotifyPlaylist,
} from "@spotify-compute-module/sdk";
import { PlaylistInfo } from "./SpotifyNowPlayingEmitter";

export class FoundryPlaylistOperations {
  constructor(private client: Client) {}

  private async executeClientAction<T, R>(
    action: string,
    params: T,
    clientCall: () => Promise<R>
  ): Promise<R | undefined> {
    try {
      const result = await clientCall();
      console.log(`${action}`, params, result);
      return result;
    } catch (e) {
      console.error(`Failed to ${action.toLowerCase()}`, e, params);
      return undefined;
    }
  }

  async createNewPlaylistInFoundry(
    playlistInfo: createNewSpotifyPlaylist.Params
  ): Promise<void> {
    await this.executeClientAction("New playlist created", playlistInfo, () =>
      this.client(createNewSpotifyPlaylist).applyAction(playlistInfo)
    );
  }

  async modifyPlaylistInFoundry(
    playlistInfo: modifySpotifyPlaylist.Params
  ): Promise<void> {
    await this.executeClientAction("Playlist modified", playlistInfo, () =>
      this.client(modifySpotifyPlaylist).applyAction(playlistInfo, {
        $returnEdits: true,
      })
    );
  }

  async deletePlaylistInFoundry(id: string): Promise<void> {
    await this.executeClientAction("Playlist deleted", id, () =>
      this.client(deleteSpotifyPlaylist).applyAction({
        spotify_playlist: id,
      })
    );
  }

  async handlePlaylistCreated(playlistInfo: PlaylistInfo) {
    console.log("Playlist created", playlistInfo.id);

    const result = await this.client(SpotifyPlaylist).fetchOneWithErrors(
      playlistInfo.id
    );
    if (isOk(result)) {
      console.log("Playlist already exists", playlistInfo.id);
      await this.modifyPlaylistInFoundry({
        spotify_playlist: result.value.playlistId,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total + "",
      });
    } else {
      console.log("Creating a new playlist", playlistInfo.id);
      await this.createNewPlaylistInFoundry({
        playlist_id: playlistInfo.id,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total,
      });
    }
  }

  async handlePlaylistModified(playlistInfo: PlaylistInfo) {
    console.log("Playlist modified", playlistInfo.id);

    const result = await this.client(SpotifyPlaylist).fetchOneWithErrors(
      playlistInfo.id
    );
    if (isOk(result)) {
      await this.modifyPlaylistInFoundry({
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
      await this.createNewPlaylistInFoundry({
        playlist_id: playlistInfo.id,
        name: playlistInfo.name,
        description: playlistInfo.description,
        owner: playlistInfo.owner.id,
        tracks_count: playlistInfo.tracks.total,
      });
    }
  }

  handlePlaylistDeleted(playlistInfo: PlaylistInfo) {
    console.log("Playlist deleted", playlistInfo.id);
    this.deletePlaylistInFoundry(playlistInfo.id);
  }
}
