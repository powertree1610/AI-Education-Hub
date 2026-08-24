import { redirect } from "next/navigation";
import { currentAppUser } from "@/lib/auth";
import { homePathFor, signInPath } from "@/lib/guard";

export default async function Home() {
  const user = await currentAppUser();
  if (!user) redirect(signInPath());
  redirect(homePathFor(user.role));
}
