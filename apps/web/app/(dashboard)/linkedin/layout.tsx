import { LinkedInSidebar } from "@/components/linkedin/linkedin-sidebar";

export default function LinkedInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-6 flex min-h-0 flex-1 overflow-hidden">
      <LinkedInSidebar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
