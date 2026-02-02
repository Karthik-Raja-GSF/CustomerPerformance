import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DataTable } from "@/pages/monthly-forecast/data-table";
import { createColumns } from "@/pages/monthly-forecast/columns";
import { mockForecastData } from "@/pages/monthly-forecast/mock-data";
import type { MonthlyForecastDto } from "@/types/monthly-forecast";

export default function MonthlyForecast() {
  const [forecasts, setForecasts] =
    useState<MonthlyForecastDto[]>(mockForecastData);
  const [addedToUpload, setAddedToUpload] = useState<Set<string>>(new Set());

  const handleAdjustedForecastUpdate = useCallback(
    async (forecast: MonthlyForecastDto, newValue: number | null) => {
      await new Promise((resolve) => setTimeout(resolve, 300));

      setForecasts((prev) =>
        prev.map((f) =>
          f.id === forecast.id ? { ...f, adjustedForecast: newValue ?? 0 } : f
        )
      );

      toast.success("Adjusted forecast updated");
    },
    []
  );

  const handleAddToUpload = useCallback((forecast: MonthlyForecastDto) => {
    setAddedToUpload((prev) => {
      const newSet = new Set(prev);
      newSet.add(forecast.id);
      return newSet;
    });
    toast.success(`${forecast.itemNumber} added to upload file`);
  }, []);

  const handleRemoveFromUpload = useCallback((forecast: MonthlyForecastDto) => {
    setAddedToUpload((prev) => {
      const newSet = new Set(prev);
      newSet.delete(forecast.id);
      return newSet;
    });
    toast.info(`${forecast.itemNumber} removed from upload file`);
  }, []);

  const columns = useMemo(
    () =>
      createColumns({
        onAdjustedForecastUpdate: handleAdjustedForecastUpdate,
        onAddToUpload: handleAddToUpload,
        onRemoveFromUpload: handleRemoveFromUpload,
        addedToUpload,
      }),
    [
      handleAdjustedForecastUpdate,
      handleAddToUpload,
      handleRemoveFromUpload,
      addedToUpload,
    ]
  );

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Monthly Future Forecast Review
        </h1>
        <p className="text-muted-foreground">
          Monthly exception-based review of items with variance ≥±25% between
          3-month average actuals and next month forecast
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable columns={columns} data={forecasts} />
      </div>
    </div>
  );
}
