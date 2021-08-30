<script lang="typescript">
  import { onMount } from "svelte";
  import Auth from "./Auth.svelte";
  import Tracks from "./Tracks.svelte";
  import Update from "./Update.svelte";

  const home = "https://playlists-21.web.app";

  let authed = false;
  let step = 0;
  let token = "";
  let tracksText = "";

  const delay = (ms: number) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms));

  const paramsToObj = (params: URLSearchParams) => {
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  };

  onMount(async () => {
    if (window.location.href.includes("#")) {
      await delay(1);
      authed = true;
      step = Math.max(step, 1);
      const authResult = window.location.href.replace(/.*#/, "");
      token = paramsToObj(new URLSearchParams(authResult)).access_token;
    }
  });
</script>

<main class="text-center sm:w-11/12 lg:w-5/6 mx-auto">
  <h1><a href={home}>Playlist generator</a></h1>
  <ol>
    <li>
      <Auth {authed} {home} />
    </li>
    <li>
      <Tracks bind:step {token} bind:tracksText />
    </li>
    <li>
      <Update bind:step {token} {tracksText} />
    </li>
  </ol>
</main>
