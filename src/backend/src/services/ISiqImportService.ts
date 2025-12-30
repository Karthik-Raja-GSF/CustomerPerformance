// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// Uncomment when SIQ tables are migrated to new database structure
/*
import { ImportLogDto, ImportResultDto } from '@/contracts/dtos/siq-import.dto';

export const SIQ_IMPORT_SERVICE_TOKEN = Symbol.for('ISiqImportService');

export interface ImportProgress {
  type: 'validation' | 'progress' | 'complete' | 'error';
  phase: 'validating' | 'processing' | 'complete';
  current: number;
  total: number;
  percentage: number;
  message?: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

export interface ISiqImportService {
  importFromBuffer(
    buffer: Buffer,
    fileName: string,
    importDate: Date
  ): Promise<ImportResultDto>;

  getImportHistory(limit?: number): Promise<ImportLogDto[]>;

  getImportById(id: string): Promise<ImportLogDto | null>;

  importFromBufferWithProgress(
    buffer: Buffer,
    fileName: string,
    importDate: Date,
    onProgress: ImportProgressCallback
  ): Promise<ImportResultDto>;
}
*/

export {};
