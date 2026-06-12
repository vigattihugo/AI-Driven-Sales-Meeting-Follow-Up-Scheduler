import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

export function createGoogleAuth(): OAuth2Client {
  const auth = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);

  auth.setCredentials({
    refresh_token: config.GOOGLE_REFRESH_TOKEN
  });

  return auth;
}
