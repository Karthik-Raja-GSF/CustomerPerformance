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
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept Excel files only
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// Validation schemas
const idParamSchema = z.object({
  id: z.string().uuid('Invalid import ID format'),
});

type IdParams = z.infer<typeof idParamSchema>;

/**
 * POST /siq-import/upload
 * Upload and import an SIQ Forecast Analysis Excel file
 */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded. Please provide an Excel file.',
        });
        return;
      }

      // Parse import date from body (optional, defaults to now)
      let importDate = new Date();
      if (req.body.importDate) {
        const parsed = new Date(req.body.importDate);
        if (!isNaN(parsed.getTime())) {
          importDate = parsed;
        }
      }

      const importService = container.resolve<ISiqImportService>(SIQ_IMPORT_SERVICE_TOKEN);
      const result = await importService.importFromBuffer(
        req.file.buffer,
        req.file.originalname,
        importDate
      );

      const statusCode = result.status === 'COMPLETED' ? 200 : 500;
      res.status(statusCode).json({
        status: result.status === 'COMPLETED' ? 'success' : 'error',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /siq-import/upload-stream
 * Upload and import with SSE progress updates
 */
router.post(
  '/upload-stream',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded. Please provide an Excel file.',
        });
        return;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      // Parse import date from body (optional, defaults to now)
      let importDate = new Date();
      if (req.body.importDate) {
        const parsed = new Date(req.body.importDate);
        if (!isNaN(parsed.getTime())) {
          importDate = parsed;
        }
      }

      // Progress callback to send SSE events
      const sendProgress = (progress: ImportProgress) => {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
        // Force flush to ensure SSE events are sent immediately
        if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
          (res as unknown as { flush: () => void }).flush();
        }
      };

      const importService = container.resolve<ISiqImportService>(SIQ_IMPORT_SERVICE_TOKEN);
      const result = await importService.importFromBufferWithProgress(
        req.file.buffer,
        req.file.originalname,
        importDate,
        sendProgress
      );

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'complete', phase: 'complete', result })}\n\n`);
      res.end();
    } catch (error) {
      // Send error as SSE event
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', phase: 'complete', message: errorMsg })}\n\n`);
      res.end();
    }
  }
);

/**
 * GET /siq-import/history
 * Get import history
 */
router.get(
  '/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

      const importService = container.resolve<ISiqImportService>(SIQ_IMPORT_SERVICE_TOKEN);
      const history = await importService.getImportHistory(limit);

      res.json({
        status: 'success',
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /siq-import/:id
 * Get a specific import by ID
 */
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const importService = container.resolve<ISiqImportService>(SIQ_IMPORT_SERVICE_TOKEN);
      const importLog = await importService.getImportById(id);

      if (!importLog) {
        res.status(404).json({
          status: 'error',
          message: 'Import not found',
        });
        return;
      }

      res.json({
        status: 'success',
        data: importLog,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
