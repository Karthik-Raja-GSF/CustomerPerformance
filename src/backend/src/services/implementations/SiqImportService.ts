// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// This service handled Excel file import for SIQ Forecast Analysis data
// It will be reformulated when SIQ tables are migrated to the new database structure
/*
import { injectable, inject } from "tsyringe";
import { PrismaClient, ImportStatus } from "@prisma/client";
import * as XLSX from "xlsx";
import { subMonths, addMonths, startOfMonth, format } from "date-fns";
import {
  ISiqImportService,
  type ImportProgressCallback,
} from "@/services/ISiqImportService";
import { ImportLogModel } from "@/contracts/models/siq-import.model";
import {
  ImportLogDto,
  ImportResultDto,
  ImportStatsDto,
} from "@/contracts/dtos/siq-import.dto";

// ... (917 lines of implementation code)
// Full implementation preserved in git history

@injectable()
export class SiqImportService implements ISiqImportService {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  // Implementation methods:
  // - importFromBuffer()
  // - importFromBufferWithProgress()
  // - getImportHistory()
  // - getImportById()
  // - processRow()
  // - validateColumns()
  // - toImportLogDto()
  // - Helper methods for type conversion
}
*/

export {};
