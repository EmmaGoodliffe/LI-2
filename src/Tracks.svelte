<script lang="typescript">
  import { fade } from "svelte/transition";
  import Bar from "./Bar.svelte";
  import { api, clump } from "./helpers";

  export let step = 0;
  export let token = "";
  export let tracksText = "";

  let queriesText = ["Rick Astley Never Gonna Give You Up", "..."].join("\n");
  let progress = 0;
  let error = "";

  interface Search {
    tracks: {
      items: { id: string }[];
    };
  }

  const click = () => {
    progress = 0.01;
    error = "";
    const run = async () => {
      const clumpedQueries = clump(
        queriesText.split("\n").filter(q => q.trim().length),
        100,
      );
      tracksText = "";
      for (const i in clumpedQueries) {
        const queriesClump = clumpedQueries[i];
        const tracks = await Promise.all(
          queriesClump.map(q =>
            api<Search>(encodeURI(`search?q=${q}&type=track`), token),
          ),
        );
        const trackIds = tracks.map((t, i) => {
          const { items } = t.tracks;
          if (items.length) return items[0].id;
          error = `Couldn't find "${queriesClump[i]}"`;
          return "";
        });
        tracksText += trackIds.join("\n") + "\n";
        progress = (parseInt(i) + 1) / clumpedQueries.length;
      }
      progress = 1;
      if (!error) {
        step = Math.max(step, 2);
      }
    };
    run().catch(err => {
      error = err;
      progress = 1;
      console.error(err);
    });
  };
</script>

<h2>2. Tracks</h2>
<p>Find your tracks on Spotify</p>
<Bar width={progress} error={!!error} />
<div class="flex flex-col md:flex-row justify-evenly">
  <div class="flex-auto">
    <p class="ta-label">Search terms for songs</p>
    <textarea rows="10" bind:value={queriesText} />
  </div>
  <div class="hidden md:flex arrow">&rarr;</div>
  <div class="flex md:hidden arrow">&darr;</div>
  <div class="flex-auto">
    <p class="ta-label">Spotify track IDs</p>
    <textarea rows="10" bind:value={tracksText} />
  </div>
</div>
<button
  class="btn"
  on:click={click}
  disabled={step < 1 || (0 < progress && progress < 1)}>Find tracks</button
>
{#if error}
  <div transition:fade={{ duration: 400 }}>
    <p class="text-bad">
      {error}
    </p>
    <button
      class="btn"
      on:click={() => {
        error = "";
        step = Math.max(step, 2);
      }}>Continue anyway</button
    >
  </div>
{/if}
