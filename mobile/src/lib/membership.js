import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

export async function schoolMembership(input) {
  const result = await httpsCallable(getFunctions(app, "europe-west1"), "schoolMembership")(input);
  return result.data;
}
