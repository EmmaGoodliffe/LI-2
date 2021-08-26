<script lang="typescript">
  export let auth: { clientId: string };
  export let data: {
    names: {
      song: string;
      artist: string;
    }[];
    ids: string[];
  };

  let authed = false;
  let status = "";

  const redirectUri = "http://localhost:5500/public/index.html";
  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    [
      `client_id=${auth.clientId}`,
      "response_type=token",
      `redirect_uri=${encodeURI(redirectUri)}`,
      "scope=playlist-read-private playlist-modify-public playlist-modify-private",
    ].join("&");

  const toBase64 = (x: string) => Buffer.from(x).toString("base64");

  const authClick = () => {
    window.location.href = authUrl;
  };

  const paramsToObj = (params: URLSearchParams) => {
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  };

  interface Playlists {
    items: { name: string; id: string }[];
  }

  interface Search {
    tracks: {
      items: { id: string }[];
    };
  }

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

  const copy = (text: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  };

  function clump<T>(arr: T[], size: number) {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  if (window.location.href.includes("#")) {
    authed = true;
  }

  const tracksClick = () => {
    const tracksRun = async () => {
      status = "fetching";
      const authResult = window.location.href.replace(/.*#/, "");
      const token = paramsToObj(new URLSearchParams(authResult)).access_token;
      const queries = data.names.map(s =>
        `${s.song} ${s.artist.replace(/&.*/g, "").replace(/\sx\s.*/, "")}`
          .replace(/\(.*?\)/g, "")
          .replace(/\s\s/g, " ")
          .trim(),
      );
      const searchUrls = queries.map(q =>
        encodeURI(`search?q=${q}&type=track`),
      );
      const clumpedSearchUrls = clump(searchUrls, 100);
      let result = "";
      for (const i in clumpedSearchUrls) {
        const searchUrlClump = clumpedSearchUrls[i];
        const tracks = await Promise.all(
          searchUrlClump.map(s =>
            // TODO: Delete `Jolen` thing
            s.includes("Jolen")
              ? {
                  tracks: { items: [{ id: "1nuDf5WpelCulE091ZK8nT" }] },
                }
              : api<Search>(s, token),
          ),
        );
        const trackIds = tracks.map((t, i) => {
          const { items } = t.tracks;
          if (items.length) return items[0].id;
          throw new Error(`couldn't find ${searchUrlClump[i]}`);
        });
        result += trackIds.join(",");
      }
      copy(result);
      status = "copied";
    };
    tracksRun().catch(err => {
      status = err;
      console.error(err);
    });
  };

  const addClick = () => {
    const addRun = async () => {
      status = "fetching";
      const authResult = window.location.href.replace(/.*#/, "");
      const token = paramsToObj(new URLSearchParams(authResult)).access_token;
      const myPlaylists = await api<Playlists>("me/playlists", token);
      const playlistId = myPlaylists.items.filter(p => p.name === "LI-2")[0].id;
      const clumps = clump(
        data.ids.map(id => `spotify:track:${id}`),
        50,
      );
      for (const i in clumps) {
        const uris = clumps[i];
        await apiBody(`playlists/${playlistId}/tracks`, token, {
          uris,
        });
        status = `${i} of ${clumps.length - 1}`;
      }
    };
    addRun().catch(err => {
      status = err;
      console.error(err);
    });
  };
</script>

<main>
  <h1>LI-2</h1>
  <div>Authed: {authed}</div>
  <div>Status: {status}</div>
  <button on:click={authClick}>Auth</button>
  <button on:click={tracksClick}>Tracks</button>
  <button on:click={addClick}>Add</button>
</main>
