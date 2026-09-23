import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signOut, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/** Public web config of the existing «Класний простір» project. Safe to ship; access is limited by Firestore rules. */
export const firebaseConfig = {
  apiKey: "AIzaSyALxxd9W3RH4g17Ygdcy3qlBR4Um6CIQ3g",
  authDomain: "schooleballs.firebaseapp.com",
  projectId: "schooleballs",
  storageBucket: "schooleballs.firebasestorage.app",
  messagingSenderId: "816513463350",
  appId: "1:816513463350:web:d419b07188f9c36ff79497",
};

let app: FirebaseApp | undefined;
let authRef: Auth | undefined;
let dbRef: Firestore | undefined;

export function firebaseApp() {
  app ??= getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function auth() {
  authRef ??= getAuth(firebaseApp());
  return authRef;
}

export function db() {
  dbRef ??= getFirestore(firebaseApp());
  return dbRef;
}

export async function signOutApp() {
  await signOut(auth());
  if (typeof window !== "undefined") window.location.href = "/login";
}
