import { cn } from "@/lib/utils";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
  PATCH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PUT: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

interface ParamRow {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  location?: "query" | "path" | "body" | "header";
}

interface EndpointProps {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  description?: string;
  scope?: string;
  params?: ParamRow[];
  children?: React.ReactNode;
}

export function Endpoint({ method, path, description, scope, params, children }: EndpointProps) {
  return (
    <div className="mt-10 first:mt-0 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "text-xs font-mono font-semibold px-2.5 py-1 rounded-md border",
            METHOD_COLORS[method]
          )}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-white/80 bg-white/5 px-3 py-1 rounded-md border border-white/10">
          {path}
        </code>
        {scope && (
          <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded border border-white/10">
            scope: {scope}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[15px] text-white/60 leading-relaxed">{description}</p>
      )}
      {params && params.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">
            Parámetros
          </p>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Nombre</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Tipo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Requerido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p, i) => (
                  <tr
                    key={p.name}
                    className={cn(
                      "border-b border-white/5 last:border-0",
                      i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono text-[#89dceb]">{p.name}</code>
                      {p.location && (
                        <span className="ml-1.5 text-[10px] text-white/25">{p.location}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs font-mono text-[#f38ba8]">{p.type}</code>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/40">
                      {p.required ? (
                        <span className="text-amber-400">requerido</span>
                      ) : (
                        "opcional"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/60">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function Hr() {
  return <hr className="border-white/10 my-10" />;
}
