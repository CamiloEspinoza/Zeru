import { redirect } from "next/navigation";

export default async function InterviewsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/org-intelligence/projects/${id}`);
}
