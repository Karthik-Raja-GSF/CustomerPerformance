import { ImportLogDto, ImportResultDto } from '@/contracts/dtos/siq-import.dto';

/**
 * SIQ Import Service Interface
 *
 * Handles importing SIQ Forecast Analysis Excel files into the normalized database.
 */
export const SIQ_IMPORT_SERVICE_TOKEN = Symbol.for('ISiqImportService');

/**
 * Progress update during import
 */
export interface ImportProgress {
  type: 'validation' | 'progress' | 'complete' | 'error';
  phase: 'validating' | 'processing' | 'complete';
  current: number;
  total: number;
  percentage: number;
  message?: string;
}

/**
 * Progress callback function type
 */
export type ImportProgressCallback = (progress: ImportProgress) => void;

export interface ISiqImportService {
  /**
   * Import data from an Excel file buffer
   * @param buffer - The Excel file buffer
   * @param fileName - Original filename for tracking
   * @param importDate - The reference date for the import (used for relative date calculations)
   * @returns Promise resolving to import results with stats
   */
  importFromBuffer(
    buffer: Buffer,
    fileName: string,
    importDate: Date
  ): Promise<ImportResultDto>;

  /**
   * Get import history
   * @param limit - Optional limit for results (default 50)
   * @returns Promise resolving to array of import log DTOs
   */
  getImportHistory(limit?: number): Promise<ImportLogDto[]>;

  /**
   * Get a specific import by ID
   * @param id - The import log UUID
   * @returns Promise resolving to import log DTO or null if not found
   */
  getImportById(id: string): Promise<ImportLogDto | null>;

  /**
   * Import data from an Excel file buffer with progress updates
   * @param buffer - The Excel file buffer
   * @param fileName - Original filename for tracking
   * @param importDate - The reference date for the import
   * @param onProgress - Callback function for progress updates
   * @returns Promise resolving to import results with stats
   */
  importFromBufferWithProgress(
    buffer: Buffer,
    fileName: string,
    importDate: Date,
    onProgress: ImportProgressCallback
  ): Promise<ImportResultDto>;
}
