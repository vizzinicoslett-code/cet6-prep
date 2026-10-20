import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", () => {
            if (registration.waiting && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event("cet6-update"));
            }
          });
        });
        if (registration.waiting)
          window.dispatchEvent(new Event("cet6-update"));
      })
      .catch(() => window.dispatchEvent(new Event("cet6-offline-unavailable")));
  });
}
