<script>
  import Bar from "./Bar.svelte";

  export let authed = false;
  export let home = "";

  const click = () => {
    const clientId = "5dfa309106f847819f19d5af2dd774cb";
    const redirectUri = home;
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
</script>

<h2>1. Authentication</h2>
<p>Automatically log in to your Spotify account</p>
<Bar width={authed ? 1 : 0} />
<button class="btn" on:click={click}>Authenticate</button>
