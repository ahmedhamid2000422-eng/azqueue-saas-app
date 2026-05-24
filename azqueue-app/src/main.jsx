import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { BranchProvider } from "./lib/BranchContext";
import App from "./App";
import "./lib/i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <App />
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
