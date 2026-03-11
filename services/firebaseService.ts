import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBwmREfkQm4uaZEPEDouET-PLt_Im1jFEU',
  authDomain: 'course-alignment-assista-e879c.firebaseapp.com',
  projectId: 'course-alignment-assista-e879c',
  storageBucket: 'course-alignment-assista-e879c.firebasestorage.app',
  messagingSenderId: '215608710387',
  appId: '1:215608710387:web:f8eebb69d65d223a755386',
  measurementId: 'G-T7KH4W9B7W',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

const GOOGLE_ACCESS_TOKEN_KEY = 'firebase_google_access_token';
const GOOGLE_ACCESS_TOKEN_EXPIRY_KEY = 'firebase_google_access_token_expiry';

export interface FirebaseSignInResult {
  accessToken: string;
  expiresAt: number;
}

export async function initiateGoogleSignIn(): Promise<FirebaseSignInResult> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error('Failed to obtain Google access token. Please try signing in again.');
  }

  const expiresAt = Date.now() + 60 * 60 * 1000;
  localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(GOOGLE_ACCESS_TOKEN_EXPIRY_KEY, String(expiresAt));

  return { accessToken, expiresAt };
}

export async function signOutFromGoogle(): Promise<void> {
  localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_ACCESS_TOKEN_EXPIRY_KEY);
  await firebaseSignOut(auth);
}

export function getStoredAccessToken(): { accessToken: string; expiresAt: number } | null {
  const token = localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
  const expiryStr = localStorage.getItem(GOOGLE_ACCESS_TOKEN_EXPIRY_KEY);
  if (!token || !expiryStr) return null;
  const expiresAt = Number(expiryStr);
  if (Date.now() > expiresAt - 5 * 60 * 1000) return null;
  return { accessToken: token, expiresAt };
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}
