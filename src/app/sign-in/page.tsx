"use client";

import { Suspense } from "react";
import SignInForm from "@/components/auth/SignInForm";

// page.tsx just wraps in Suspense
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
