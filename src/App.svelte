<script lang="typescript">
  import { onMount } from "svelte";
  import Bar from "./Bar.svelte";

  let clientId = "5dfa309106f847819f19d5af2dd774cb";
  let authed = false;
  let queriesText = ["Rick Astley Never Gonna Give You Up", "..."].join("\n");
  let tracksText = "";
  let tracksProgress = 0;
  let playlistName = "Test";
  let addProgress = 0;

  interface Playlists {
    items: { name: string; id: string }[];
  }

  interface Search {
    tracks: {
      items: { id: string }[];
    };
  }

  const delay = (ms: number) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms));

  const paramsToObj = (params: URLSearchParams) => {
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  };

  const api = async <T extends Playlists | Search>(
    endPoint: string,
    token: string,
  ) => {
    const url = `https://api.spotify.com/v1/${endPoint}`;
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
    });
    return (await response.json()) as T;
  };

  const apiBody = async (
    endPoint: string,
    token: string,
    body: Record<string, unknown>,
    method?: "POST" | "DELETE",
  ) => {
    const url = `https://api.spotify.com/v1/${endPoint}`;
    const response = await fetch(url, {
      method: method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body),
    });
    return await response.json();
  };

  function clump<T>(arr: T[], size: number) {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  const authClick = () => {
    const redirectUri = "http://localhost:5500/public/index.html";
    const authUrl =
      "https://accounts.spotify.com/authorize?" +
      [
        `client_id=${clientId}`,
        "response_type=token",
        `redirect_uri=${encodeURI(redirectUri)}`,
        "scope=playlist-read-private playlist-modify-public playlist-modify-private",
      ].join("&");
    window.location.href = authUrl;
  };

  const tracksClick = () => {
    const tracksRun = async () => {
      const authResult = window.location.href.replace(/.*#/, "");
      const token = paramsToObj(new URLSearchParams(authResult)).access_token;
      const searchUrls = queriesText
        .split("\n")
        .map(q => encodeURI(`search?q=${q}&type=track`));
      const clumpedSearchUrls = clump(searchUrls, 100);
      tracksText = "";
      tracksProgress = 0.01;
      for (const i in clumpedSearchUrls) {
        const searchUrlClump = clumpedSearchUrls[i];
        const tracks = await Promise.all(
          searchUrlClump.map(s => api<Search>(s, token)),
        );
        const trackIds = tracks.map((t, i) => {
          const { items } = t.tracks;
          if (items.length) return items[0].id;
          throw new Error(`Couldn't find ${searchUrlClump[i]}`);
        });
        tracksText += trackIds.join("\n") + "\n";
        tracksProgress = (parseInt(i) + 1) / clumpedSearchUrls.length;
      }
    };
    tracksRun().catch(err => {
      console.error(err);
    });
  };

  const addClick = () => {
    const addRun = async () => {
      const authResult = window.location.href.replace(/.*#/, "");
      const token = paramsToObj(new URLSearchParams(authResult)).access_token;
      const myPlaylists = await api<Playlists>("me/playlists", token);
      const playlistId = myPlaylists.items.filter(
        p => p.name === playlistName,
      )[0].id;
      const clumps = clump(tracksText.split("\n"), 100);
      addProgress = 0.01;
      for (const i in clumps) {
        const ids = clumps[i].filter(id => id.trim().length);
        await apiBody(`playlists/${playlistId}/tracks`, token, {
          uris: ids.map(id => `spotify:track:${id.trim()}`),
        });
        addProgress = (parseInt(i) + 1) / clumps.length;
      }
    };
    addRun().catch(err => {
      console.error(err);
    });
  };

  onMount(async () => {
    if (window.location.href.includes("#")) {
      await delay(1);
      authed = true;
    }
  });
</script>

<main class="text-center w-full">
  <h1>Playlist generator</h1>
  <ul>
    <li>
      <h2>Authentication</h2>
      <Bar width={authed ? 1 : 0} />
      <input type="text" placeholder="Client ID" bind:value={clientId} />
      <br />
      <button class="btn" on:click={authClick}>Auth</button>
    </li>
    <li>
      <h2>Tracks</h2>
      <Bar width={tracksProgress} />
      <div class="flex justify-evenly">
        <div class="flex-1">
          <textarea rows="10" bind:value={queriesText} />
        </div>
        <div class="flex-1">
          <textarea rows="10" bind:value={tracksText} />
        </div>
      </div>
      <button
        class="btn"
        on:click={tracksClick}
        disabled={!authed || (0 < tracksProgress && tracksProgress < 1)}
        >Tracks</button
      >
    </li>
    <li>
      <h2>Add</h2>
      <Bar width={addProgress} />
      <input
        type="text"
        placeholder="Playlist name"
        bind:value={playlistName}
      />
      <br />
      <button
        class="btn"
        on:click={addClick}
        disabled={!authed || (0 < addProgress && addProgress < 1)}>Add</button
      >
    </li>
  </ul>
</main>
