import { ConversationsSidebar } from "@/components/assistant/conversations-sidebar";

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // -m-6 undoes the dashboard's p-6, -mt-4 undoes the gap-4 from flex col
    // This lets the assistant fill the full inset area edge-to-edge
    <div className="-m-6 flex min-h-0 flex-1 overflow-hidden">
      <ConversationsSidebar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
