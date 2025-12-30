// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// This router handled Excel file upload and import for SIQ Forecast Analysis data
// Endpoints: POST /upload, POST /upload-stream (SSE), GET /history, GET /:id
/*
import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { container } from 'tsyringe';
import { ISiqImportService, SIQ_IMPORT_SERVICE_TOKEN, type ImportProgress } from '@/services/ISiqImportService';
import { authenticate } from '@/middleware/authenticate';
import { validateRequest } from '@/middleware/validate-request';

const router: IRouter = Router();

// Configure multer for memory storage (file buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// Routes:
// POST /upload - Standard file upload
// POST /upload-stream - SSE-based streaming with progress updates
// GET /history - Import history (limit parameter, default 50)
// GET /:id - Get specific import by UUID

export default router;
*/

import { Router, IRouter } from "express";
const router: IRouter = Router();
export default router;
