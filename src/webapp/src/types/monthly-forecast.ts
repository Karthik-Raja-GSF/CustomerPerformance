export interface MonthlyForecastDto {
  id: string;
  location: string;
  itemNumber: string;
  description: string;
  threeMonthAvgActuals: number;
  currentActuals: number;
  lastYearNextMonthActuals: number;
  nextMonthForecast: number;
  monthPlus2Forecast: number;
  monthPlus3Forecast: number;
  variancePercent: number;
  adjustedForecast: number;
  top5Customers: string[];
  dpNotes: string | null;
}
