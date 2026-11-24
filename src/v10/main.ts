import "./style.css";
import { Game } from "./Game";
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(console.warn);
try {
  const game = new Game();
  void game.init();
} catch (e) {
  document.querySelector("#loading")!.textContent =
    "Seu navegador não conseguiu iniciar WebGL2. " + String(e);
  console.error(e);
}
