<script lang="typescript">
  export let width = 0;
  export let error = false;
</script>

<div class="bg-light-s w-11/12 sm:w-5/6 max-w-2xl h-4 mx-auto mt-6 rounded-sm">
  <div
    class={`${
      width === 1 ? (error ? "bg-bad" : "bg-good") : "bg-s"
    } w-0 h-full rounded-sm smooth`}
    style={`width: ${100 * width}%`}
  />
</div>
