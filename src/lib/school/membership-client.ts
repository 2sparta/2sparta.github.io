import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";

export function schoolMembership(
  input: Record<string, unknown> & { action: "createChat" },
): Promise<{ id: string }>;
export function schoolMembership(input: Record<string, unknown>): Promise<{ schoolId: string }>;
export async function schoolMembership(input: Record<string, unknown>): Promise<any> {
  try {
    const result = await httpsCallable<Record<string, unknown>, { schoolId?: string; id?: string }>(
      getFunctions(firebaseApp(), "europe-west1"),
      "schoolMembership",
    )(input);
    return result.data;
  } catch (e) {
    // Keep existing localized onboarding errors without exposing provider details.
    if (
      e instanceof Error &&
      ["CODE_NOT_FOUND", "CODE_USED", "RATE_LIMIT", "ALREADY_LINKED", "FORBIDDEN"].includes(
        e.message,
      )
    )
      throw new Error(e.message);
    throw e;
  }
}
