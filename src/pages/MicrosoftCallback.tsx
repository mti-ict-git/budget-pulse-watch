import { useEffect } from "react";

/**
 * Entra ID redirect target when the redirect URI is APP_URL/auth/microsoft/callback (a frontend path).
 * Hands Microsoft's code and state, unchanged, to the backend callback, which finishes the sign-in and
 * returns to /login. See docs/m365-sso.md.
 */
export default function MicrosoftCallback() {
  useEffect(() => {
    window.location.replace(`/api/auth/microsoft/callback${window.location.search}`);
  }, []);
  return <p style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>Signing in with Microsoft 365…</p>;
}
