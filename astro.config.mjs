// @ts-check
import { defineConfig } from "astro/config";

// The Warehouse — static site for GitHub Pages.
//
// GitHub Pages serves a project repo from a sub-path:
//   https://<user>.github.io/ProjectRepository/
// so `base` must match the repo name. If/when a custom domain is wired up,
// set `site` to that domain and change `base` back to "/".
export default defineConfig({
  site: "https://vgit-it.github.io",
  base: "/ProjectRepository",
  output: "static",
  trailingSlash: "ignore",
});
