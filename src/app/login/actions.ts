"use server";

import { signIn } from "@/auth";

export async function signInWithGoogle(formData: FormData) {
  const next = formData.get("next")?.toString() || "/";
  await signIn("google", { redirectTo: next });
}
