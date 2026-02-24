type Status = "proximas-semanas" | "proximo-mes" | "planificado";

const statusConfig: Record<Status, { label: string; color: string; dot: string }> = {
  "proximas-semanas": {
    label: "Próximas semanas",
    color: "bg-teal-500/15 text-teal-400 border-teal-500/25",
    dot: "bg-teal-400",
  },
  "proximo-mes": {
    label: "Próximo mes",
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
    title: "Inventario",
    description: "Control de stock, productos, movimientos y valorización en tiempo real.",
    status: "proximas-semanas",
    icon: "📦",
  },
  {
    title: "Órdenes de compra",
    description: "Flujo completo de compras: cotización, OC, recepción y contabilización automática.",
    status: "proximas-semanas",
    icon: "🛒",
  },
  {
    title: "Documentos electrónicos (DTE)",
    description: "Emisión y recepción de facturas, boletas y notas de crédito via SII.",
    status: "proximas-semanas",
    icon: "🧾",
  },
  {
    title: "Conciliación bancaria automática",
    description: "Importa cartolas y la IA concilia movimientos contra asientos contables.",
    status: "proximo-mes",
    icon: "🏦",
  },
  {
    title: "Medios de pago",
    description: "Recibe pagos online con Khipu, Transbank y otros. Conciliación automática.",
    status: "proximo-mes",
    icon: "💳",
  },
  {
    title: "Automatización de cobranza",
    description: "Emails, WhatsApp y llamadas automáticas para recordar deudas pendientes.",
    status: "proximo-mes",
    icon: "📞",
  },
  {
    title: "Presupuestos y proyecciones",
    description: "Crea presupuestos anuales, compara con la ejecución real y proyecta flujos.",
    status: "planificado",
    icon: "📊",
  },
  {
    title: "Alertas de presupuesto",
    description: "Notificaciones cuando un centro de costo supera un % del presupuesto.",
    status: "planificado",
    icon: "🔔",
  },
  {
    title: "Productos y catálogo",
    description: "Ficha de producto con precios, costos, impuestos y variantes.",
    status: "planificado",
    icon: "🏷️",
  },
  {
    title: "CRM básico",
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
    title: "Atención al cliente",
    description: "Bandeja unificada: WhatsApp, email e IA para respuestas automáticas.",
    status: "planificado",
    icon: "💬",
  },
  {
    title: "Marketing outbound",
    description: "Campañas de email y WhatsApp segmentadas desde los datos de tu CRM.",
    status: "planificado",
    icon: "📣",
  },
  {
    title: "Control de gestión",
    description: "Dashboard de KPIs, márgenes por línea de negocio y análisis de rentabilidad.",
    status: "planificado",
    icon: "🎯",
  },
  {
    title: "Nuevos modelos de IA",
    description: "Soporte para Claude, Gemini, Llama y más proveedores según el usuario elija.",
    status: "planificado",
    icon: "🤖",
  },
];

export function RoadmapSection() {
  const byStatus = {
    "proximas-semanas": roadmap.filter((r) => r.status === "proximas-semanas"),
    "proximo-mes": roadmap.filter((r) => r.status === "proximo-mes"),
    planificado: roadmap.filter((r) => r.status === "planificado"),
  };

  return (
    <section id="roadmap" className="py-28 px-6 relative">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-teal-500/5 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="max-w-2xl mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium mb-4">
            Roadmap público
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Lo que viene
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Zeru está creciendo rápido. Aquí puedes ver qué se viene y cuándo.
            El roadmap es público y evoluciona con el feedback de los usuarios.
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
