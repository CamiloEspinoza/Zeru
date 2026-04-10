export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-1 flex-col min-h-0 -m-6">{children}</div>;
}
