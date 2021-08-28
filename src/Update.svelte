<script lang="typescript">
  import { fade } from "svelte/transition";
  import Bar from "./Bar.svelte";
  import { api, apiBody, clump } from "./helpers";

  export let step = 0;
  export let token = "";
  export let tracksText = "";

  let playlistName = "";
  let progress = 0;
  let error = "";

  interface Playlists {
    items: { name: string; id: string }[];
  }

  const click = () => {
    progress = 0.01;
    error = "";
    const run = async () => {
      const playlists = await api<Playlists>("me/playlists", token);
      const matchingPlaylists = playlists.items.filter(
        p => p.name === playlistName,
      );
      if (!matchingPlaylists.length) {
        if (!playlistName.length) {
          throw "No playlist name provided";
        }
        throw `Couldn't find "${playlistName}"`;
      }
      const playlistId = matchingPlaylists[0].id;
      const clumps = clump(
        tracksText.split("\n").filter(id => id.trim().length),
        100,
      );
      for (const i in clumps) {
        const ids = clumps[i];
        await apiBody(`playlists/${playlistId}/tracks`, token, {
          uris: ids.map(id => `spotify:track:${id.trim()}`),
        });
        progress = (parseInt(i) + 1) / clumps.length;
      }
      progress = 1;
      step = Math.max(step, 3);
    };
    run().catch(err => {
      error = err;
      progress = 1;
      console.error(err);
    });
  };
</script>

<h2>3. Update</h2>
<p>Update a playlist to include your tracks</p>
<Bar width={progress} error={!!error} />
<input type="text" placeholder="Playlist name" bind:value={playlistName} />
<br />
<button
  class="btn"
  on:click={click}
  disabled={step < 2 || (0 < progress && progress < 1)}>Update</button
>
{#if error}
  <p class="text-bad duration-short" transition:fade>
    {error}
  </p>
{/if}
