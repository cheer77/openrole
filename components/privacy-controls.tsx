"use client";
import { useState } from "react";
export function PrivacyControls() {
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          try {
            localStorage.setItem("openrole-analytics-disabled", "1");
            localStorage.removeItem("openrole-visitor");
            sessionStorage.removeItem("openrole-session");
            setMessage("Analytics is disabled for this browser.");
          } catch {
            setMessage(
              "Browser storage is unavailable. Analytics is already disabled.",
            );
          }
        }}
      >
        Disable analytics
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
