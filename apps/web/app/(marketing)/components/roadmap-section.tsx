type Status = "proximas-semanas" | "proximo-mes" | "planificado";

const statusConfig: Record<Status, { label: string; color: string; dot: string }> = {
  "proximas-semanas": {
    label: "Proximas semanas",
    color: "bg-teal-500/15 text-teal-400 border-teal-500/25",
    dot: "bg-teal-400",
  },
  "proximo-mes": {
    label: "Proximo mes",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    dot: "bg-blue-400",
  },
  planificado: {
    label: "Planificado",
    color: "bg-white/5 text-white/40 border-white/10",
    dot: "bg-white/30",
  },
};

const roadmap: Array<{
  title: string;
  description: string;
  status: Status;
  icon: string;
}> = [
  {
    title: "Gestion de RRHH",
    description: "Contratos, vacaciones, asistencia y evaluaciones de desempeno.",
    status: "proximas-semanas",
    icon: "📋",
  },
  {
    title: "Gestion Documental",
    description: "Flujos de aprobacion, firma electronica y versionado de documentos.",
    status: "proximas-semanas",
    icon: "📄",
  },
  {
    title: "Reportes y BI",
    description: "Dashboards customizables y KPIs en tiempo real.",
    status: "proximas-semanas",
    icon: "📊",
  },
  {
    title: "Integraciones",
    description: "Conexion con SAP, Google Workspace, Microsoft 365 y mas.",
    status: "proximo-mes",
    icon: "🔗",
  },
  {
    title: "API Publica",
    description: "Endpoints, webhooks y SDK para desarrolladores.",
    status: "proximo-mes",
    icon: "🔌",
  },
  {
    title: "Inventario",
    description: "Control de stock, productos, movimientos y valorizacion en tiempo real.",
    status: "proximo-mes",
    icon: "📦",
  },
  {
    title: "Ordenes de compra",
    description: "Cotizacion, OC, recepcion y contabilizacion automatica.",
    status: "planificado",
    icon: "🛒",
  },
  {
    title: "Documentos electronicos (DTE)",
    description: "Emision y recepcion de facturas, boletas y notas de credito via SII.",
    status: "planificado",
    icon: "🧾",
  },
  {
    title: "Conciliacion bancaria",
    description: "Importa cartolas y la IA concilia movimientos contra asientos contables.",
    status: "planificado",
    icon: "🏦",
  },
  {
    title: "CRM",
    description: "Auxiliar de clientes y proveedores con historial de operaciones.",
    status: "planificado",
    icon: "👥",
  },
  {
    title: "Venta online",
    description: "Tienda propia integrada al inventario, DTE y medios de pago.",
    status: "planificado",
    icon: "🛍️",
  },
  {
    title: "Control de gestion",
    description: "Dashboard de KPIs, margenes por linea de negocio y analisis de rentabilidad.",
    status: "planificado",
    icon: "🎯",
  },
];

export function RoadmapSection() {
  const byStatus = {
    "proximas-semanas": roadmap.filter((r) => r.status === "proximas-semanas"),
    "proximo-mes": roadmap.filter((r) => r.status === "proximo-mes"),
    planificado: roadmap.filter((r) => r.status === "planificado"),
  };

  return (
    <section id="roadmap" className="py-28 px-6 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-teal-500/5 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="max-w-2xl mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium mb-4">
            Roadmap publico
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Lo que viene
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Zeru esta creciendo rapido. Aqui puedes ver que se viene y cuando.
            El roadmap es publico y evoluciona con el feedback de los usuarios.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-10">
          {(Object.keys(statusConfig) as Status[]).map((s) => (
            <div key={s} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${statusConfig[s].color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dot}`} />
              {statusConfig[s].label}
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="grid md:grid-cols-3 gap-6">
          {(["proximas-semanas", "proximo-mes", "planificado"] as Status[]).map((status) => (
            <div key={status}>
              <div className={`mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${statusConfig[status].color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[status].dot}`} />
                {statusConfig[status].label}
              </div>
              <div className="space-y-3">
                {byStatus[status].map((item, i) => (
                  <div
                    key={item.title}
                    className="group rounded-xl border border-white/6 bg-white/[0.02] p-4 hover:border-white/10 transition-colors fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                      <div>
                        <h3 className="font-semibold text-sm text-white/80 group-hover:text-white transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-white/35 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
