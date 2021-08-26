import App from "./App.svelte";
import data from "./data";

const app = new App({
  target: document.body,
  props: {
    auth: { clientId: "5dfa309106f847819f19d5af2dd774cb" },
    data: {
      names: data.names.map(n => {
        let [artist, song] = n.split(" - ");
        song = song
          .slice(1, -1)
          .replace(/\(.*?\)/g, "")
          .replace(/Extended.*/g, "");
        artist = artist
          .replace(/\(.*?\)/g, "")
          .replace(/&.*/g, "")
          .replace(/,.*/g, "")
          .replace(/ft.*/g, "");
        return { song, artist };
      }),
      ids: data.ids,
    },
  },
});

export default app;
