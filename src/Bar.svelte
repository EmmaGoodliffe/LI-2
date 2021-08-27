<script lang="typescript">
  export let width = 0;
</script>

<div class="bg-w w-11/12 sm:w-5/6 md:w-1/2 h-4 mx-auto mt-6 rounded-sm">
  <div
    class={`${
      width === 1 ? "bg-good" : "bg-s"
    } w-0 h-full rounded-sm transition-all duration-700`}
    style={`width: ${100 * width}%`}
  />
</div>
