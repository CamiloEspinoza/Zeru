import { HeroChat } from "@/app/(marketing)/components/hero-chat";

export function AuthCover() {
  return (
    <div className="hidden lg:flex flex-col gap-8">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
          El contador que{" "}
          <span className="text-teal-400">piensa</span> contigo
        </h2>
        <p className="text-sm text-white/45 leading-relaxed max-w-xs">
          Analiza documentos, propone asientos y responde preguntas — en
          conversación, como un contador de verdad.
        </p>
      </div>

      <div className="relative">
        <HeroChat />
        <div className="absolute -inset-4 rounded-3xl bg-teal-500/5 blur-2xl -z-10" />
      </div>
    </div>
  );
}
