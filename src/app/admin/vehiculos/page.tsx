import { PageHeader } from "@/components/page-header";
import {
  listVehicleBrands,
  listVehicleModels,
  listVehicleTypes,
} from "@/features/saas-admin/queries";
import { VehiclesPanel } from "@/features/saas-admin/components/vehicles-panel";

export default async function AdminVehiculosPage() {
  const [brands, models, types] = await Promise.all([
    listVehicleBrands(),
    listVehicleModels(),
    listVehicleTypes(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehículos (catálogo global)"
        description="Marcas, modelos y tipos compartidos entre todas las corredoras. Se usan como autocompletado en las fichas de Vehículos Motorizados, SOAP y Equipo Móvil. Los corredores pueden escribir un valor que no esté listado, pero ese texto queda solo en la ficha del ítem."
      />
      <VehiclesPanel brands={brands} models={models} types={types} />
    </div>
  );
}
