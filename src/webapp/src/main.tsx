import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted Google Fonts (before index.css so @font-face rules register first)
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/500.css";

import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/contexts/auth-context";
import { apiClient } from "@/apis/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider
      onRefresh={(authResponse) => {
        apiClient.setAuthToken(authResponse.idToken);
      }}
    >
      <App />
    </AuthProvider>
  </StrictMode>
);
