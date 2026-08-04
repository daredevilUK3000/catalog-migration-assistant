import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import ImportForm from "./ImportForm";

export default async function ImportPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  return <ImportForm />;
}
