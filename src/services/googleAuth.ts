import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/userinfo.profile");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Load cached token from session/memory
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have a cached token in memory, reuse it
  if (cachedAccessToken && auth.currentUser) {
    if (onAuthSuccess) onAuthSuccess(auth.currentUser, cachedAccessToken);
  }

  // Also check session storage just in case page refreshed to maintain UX,
  // though the instruction says "Do NOT store the access token in localStorage or sessionStorage. Use onAuthStateChanged to clear..."
  // Wait, let's strictly follow the instruction:
  // "You MUST implement in-memory caching for the access token. Do NOT store the access token in localStorage or sessionStorage."
  // Okay! We will strictly use in-memory cachedAccessToken.
  
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress. Ignoring duplicate request.");
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const isCancelled = error && (
      error.code === "auth/popup-closed-by-user" || 
      error.code === "auth/cancelled-popup-request" ||
      error.message?.includes("popup-closed-by-user") ||
      error.message?.includes("cancelled-popup-request")
    );
    if (isCancelled) {
      console.warn("Sign in cancelled or duplicated popup request:", error.message || error);
      return null;
    } else {
      console.error("Sign in error:", error);
      throw error;
    }
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
