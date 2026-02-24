import { redirect } from "next/navigation";

// /assistant always redirects to a new conversation
export default function AssistantPage() {
  redirect("/assistant/new");
}
