import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function InvoicingBooksPage() {
  return (
    <ModulePlaceholder
      icon={Invoice01Icon}
      title="Libros de Compra y Venta"
      description="Libros de compra y venta electrónicos. Generación automática a partir de DTEs emitidos y recibidos."
      features={[
        "Libro de Ventas generado automáticamente desde DTEs emitidos",
        "Libro de Compras con ingreso manual y carga desde SII",
        "Resumen de IVA débito y crédito fiscal por período",
        "Exportación en formato compatible con SII",
        "Conciliación con registros contables",
      ]}
    />
  );
}
