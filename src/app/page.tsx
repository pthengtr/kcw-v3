import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // if logged in, go to app
  if (user) {
    redirect("/app");
  }

  // otherwise, go to sign-in
  redirect("/sign-in");
}
