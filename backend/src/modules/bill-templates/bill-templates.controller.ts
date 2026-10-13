import { Request, Response, NextFunction } from 'express';
import * as service from './bill-templates.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      template_type: req.query.template_type as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined
    };
    const templates = await service.listTemplates(filters);
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await service.getTemplateById(req.params.id as string);
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await service.createTemplate(req.body, req.user!.id);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await service.updateTemplate(req.params.id as string, req.body, req.user!.id);
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteTemplate(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function uploadAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const asset = await service.uploadAsset(req.params.id as string, req.body, req.user!.id);
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
}

export async function getAssetFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { stream, mimeType, fileName } = await service.getAssetFile(
      req.params.id as string,
      req.params.assetId as string
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Asset stream error:', err);
      if (!res.headersSent) {
        next(err);
      } else {
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteAsset(
      req.params.id as string,
      req.params.assetId as string,
      req.user!.id
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function preview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.previewTemplate(req.body);
    if (result.format === 'json') {
      res.json({ success: true, data: result });
    } else {
      res.setHeader('Content-Type', result.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
      res.setHeader('Content-Length', result.buffer ? result.buffer.length : 0);
      res.end(result.buffer);
    }
  } catch (error) {
    next(error);
  }
}

export async function importTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await service.importTemplate(req.body);
    res.json({ success: true, data: draft });
  } catch (error) {
    next(error);
  }
}
