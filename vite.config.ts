import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "physics", test: /rapier3d/ },
            { name: "rendering", test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
});
