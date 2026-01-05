import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
