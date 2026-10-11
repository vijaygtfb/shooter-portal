import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primeicons/primeicons.css";
import "./index.css";
import App from "./App";
import { ToastProvider } from "./components/ToastProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrimeReactProvider value={{ ripple: true }}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </PrimeReactProvider>
  </StrictMode>,
);
