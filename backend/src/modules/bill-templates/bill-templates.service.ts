import crypto from 'crypto';
import { Readable } from 'stream';
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { storageService } from '../../services/storage.service';
import { generateBillPdfBuffer } from '../bills/bill-pdf.generator';
import { resolveDynamicFields } from './dynamic-fields.resolver';

export interface ListTemplatesFilters {
  template_type?: string;
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export async function listTemplates(filters?: ListTemplatesFilters) {
  let sql = `
    SELECT bt.id, bt.name, bt.template_type, bt.status, bt.layout_json, bt.created_by, bt.created_at, bt.updated_at,
           u.name as created_by_name,
           (SELECT COUNT(*)::int FROM bill_template_components btc WHERE btc.template_id = bt.id) as component_count,
           (SELECT COUNT(*)::int FROM bill_template_dynamic_fields btdf WHERE btdf.template_id = bt.id) as dynamic_field_count,
           (SELECT COUNT(*)::int FROM bill_template_assets bta WHERE bta.template_id = bt.id) as asset_count
    FROM bill_templates bt
    LEFT JOIN users u ON u.id = bt.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.template_type) {
    params.push(filters.template_type);
    sql += ` AND bt.template_type = $${params.length}`;
  }

  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND bt.status = $${params.length}`;
  }

  if (filters?.search) {
    params.push(`%${filters.search}%`);
    sql += ` AND bt.name ILIKE $${params.length}`;
  }

  sql += ` ORDER BY bt.created_at DESC`;

  if (filters?.page && filters?.limit) {
    const pageNum = parseInt(filters.page, 10);
    const limitNum = parseInt(filters.limit, 10);
    const offset = (pageNum - 1) * limitNum;
    params.push(limitNum);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const res = await query(sql, params);
  return res.rows;
}

export async function getTemplateById(id: string, client?: any) {
  const runner = client || { query };
  const tRes = await runner.query(
    `SELECT bt.*, u.name as created_by_name
     FROM bill_templates bt
     LEFT JOIN users u ON u.id = bt.created_by
     WHERE bt.id = $1`,
    [id]
  );

  if (tRes.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Bill template not found', 404);
  }
  const template = tRes.rows[0];

  // Components
  const cRes = await runner.query(
    `SELECT id, component_type, component_key, position_x, position_y, width, height, style_json, content_json, created_at, updated_at
     FROM bill_template_components
     WHERE template_id = $1
     ORDER BY component_key ASC`,
    [id]
  );
  template.components = cRes.rows;

  // Dynamic fields
  const dfRes = await runner.query(
    `SELECT btdf.id, btdf.binding_path, btdf.display_label, btdf.is_repeatable, btdf.default_value,
            df.id as field_definition_id, df.source_entity, df.field_key, df.field_label, df.data_type
     FROM bill_template_dynamic_fields btdf
     JOIN dynamic_field_definitions df ON df.id = btdf.field_definition_id
     WHERE btdf.template_id = $1
     ORDER BY btdf.binding_path ASC`,
    [id]
  );
  template.dynamic_fields = dfRes.rows;

  // Assets
  const aRes = await runner.query(
    `SELECT id, asset_type, file_name, storage_key, content_checksum, mime_type, width, height, created_at
     FROM bill_template_assets
     WHERE template_id = $1
     ORDER BY file_name ASC`,
    [id]
  );
  template.assets = aRes.rows;

  return template;
}

export async function createTemplate(data: any, userId: string) {
  return withTransaction(async (client) => {
    // Check name uniqueness
    const nameCheck = await client.query('SELECT id FROM bill_templates WHERE name = $1', [data.name]);
    if (nameCheck.rowCount && nameCheck.rowCount > 0) {
      throw new AppError('CONFLICT', `Template with name "${data.name}" already exists`, 409);
    }

    // Check component keys uniqueness
    if (data.components && Array.isArray(data.components)) {
      const keySet = new Set<string>();
      for (const comp of data.components) {
        if (keySet.has(comp.component_key)) {
          throw new AppError('VALIDATION_ERROR', `Duplicate component_key: ${comp.component_key}`, 400);
        }
        keySet.add(comp.component_key);
      }
    }

    // Insert bill_templates
    const tRes = await client.query(
      `INSERT INTO bill_templates (name, template_type, status, layout_json, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.template_type,
        data.status || 'DRAFT',
        data.layout_json || {},
        userId
      ]
    );
    const template = tRes.rows[0];

    // Insert components
    if (data.components && Array.isArray(data.components) && data.components.length > 0) {
      for (const comp of data.components) {
        await client.query(
          `INSERT INTO bill_template_components
           (template_id, component_type, component_key, position_x, position_y, width, height, style_json, content_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            template.id,
            comp.component_type,
            comp.component_key,
            comp.position_x ?? null,
            comp.position_y ?? null,
            comp.width ?? null,
            comp.height ?? null,
            comp.style_json || {},
            comp.content_json || {}
          ]
        );
      }
    }

    // Insert dynamic fields bindings
    if (data.dynamic_fields && Array.isArray(data.dynamic_fields) && data.dynamic_fields.length > 0) {
      for (const field of data.dynamic_fields) {
        // Validate field definition exists
        const defRes = await client.query('SELECT id FROM dynamic_field_definitions WHERE id = $1', [field.field_definition_id]);
        if (defRes.rowCount === 0) {
          throw new AppError('VALIDATION_ERROR', `Dynamic field definition not found: ${field.field_definition_id}`, 400);
        }

        await client.query(
          `INSERT INTO bill_template_dynamic_fields
           (template_id, field_definition_id, binding_path, display_label, is_repeatable, default_value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            template.id,
            field.field_definition_id,
            field.binding_path,
            field.display_label || null,
            field.is_repeatable || false,
            field.default_value || null
          ]
        );
      }
    }

    await createAudit(
      {
        entityType: 'BILL_TEMPLATE',
        entityId: template.id,
        action: 'CREATE',
        newState: template,
        userId
      },
      client
    );

    return getTemplateById(template.id, client);
  });
}

export async function updateTemplate(id: string, data: any, userId: string) {
  return withTransaction(async (client) => {
    const existing = await getTemplateById(id, client);

    // If name changed, check uniqueness
    if (data.name && data.name !== existing.name) {
      const nameCheck = await client.query('SELECT id FROM bill_templates WHERE name = $1 AND id != $2', [data.name, id]);
      if (nameCheck.rowCount && nameCheck.rowCount > 0) {
        throw new AppError('CONFLICT', `Template with name "${data.name}" already exists`, 409);
      }
    }

    // Update bill_templates columns
    const name = data.name !== undefined ? data.name : existing.name;
    const template_type = data.template_type !== undefined ? data.template_type : existing.template_type;
    const status = data.status !== undefined ? data.status : existing.status;
    const layout_json = data.layout_json !== undefined ? data.layout_json : existing.layout_json;

    const uRes = await client.query(
      `UPDATE bill_templates
       SET name = $1, template_type = $2, status = $3, layout_json = $4, updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [name, template_type, status, layout_json, id]
    );
    const updated = uRes.rows[0];

    // If components provided, replace them
    if (data.components !== undefined && Array.isArray(data.components)) {
      const keySet = new Set<string>();
      for (const comp of data.components) {
        if (keySet.has(comp.component_key)) {
          throw new AppError('VALIDATION_ERROR', `Duplicate component_key: ${comp.component_key}`, 400);
        }
        keySet.add(comp.component_key);
      }

      await client.query('DELETE FROM bill_template_components WHERE template_id = $1', [id]);

      for (const comp of data.components) {
        await client.query(
          `INSERT INTO bill_template_components
           (template_id, component_type, component_key, position_x, position_y, width, height, style_json, content_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            comp.component_type,
            comp.component_key,
            comp.position_x ?? null,
            comp.position_y ?? null,
            comp.width ?? null,
            comp.height ?? null,
            comp.style_json || {},
            comp.content_json || {}
          ]
        );
      }
    }

    // If dynamic fields provided, replace them
    if (data.dynamic_fields !== undefined && Array.isArray(data.dynamic_fields)) {
      for (const field of data.dynamic_fields) {
        const defRes = await client.query('SELECT id FROM dynamic_field_definitions WHERE id = $1', [field.field_definition_id]);
        if (defRes.rowCount === 0) {
          throw new AppError('VALIDATION_ERROR', `Dynamic field definition not found: ${field.field_definition_id}`, 400);
        }
      }

      await client.query('DELETE FROM bill_template_dynamic_fields WHERE template_id = $1', [id]);

      for (const field of data.dynamic_fields) {
        await client.query(
          `INSERT INTO bill_template_dynamic_fields
           (template_id, field_definition_id, binding_path, display_label, is_repeatable, default_value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            field.field_definition_id,
            field.binding_path,
            field.display_label || null,
            field.is_repeatable || false,
            field.default_value || null
          ]
        );
      }
    }

    await createAudit(
      {
        entityType: 'BILL_TEMPLATE',
        entityId: id,
        action: 'UPDATE',
        previousState: existing,
        newState: updated,
        userId
      },
      client
    );

    return getTemplateById(id, client);
  });
}

export async function deleteTemplate(id: string, userId: string) {
  return withTransaction(async (client) => {
    const existing = await getTemplateById(id, client);

    // Check party billing configs reference
    const pbcCheck = await client.query(
      'SELECT id FROM party_billing_configs WHERE default_template_id = $1 LIMIT 1',
      [id]
    );
    if (pbcCheck.rowCount && pbcCheck.rowCount > 0) {
      throw new AppError(
        'BUSINESS_RULE_VIOLATION',
        'Cannot delete template that is set as default template for one or more parties',
        422
      );
    }

    // Check bill versions reference
    const bvCheck = await client.query(
      'SELECT id FROM bill_versions WHERE template_id = $1 LIMIT 1',
      [id]
    );
    if (bvCheck.rowCount && bvCheck.rowCount > 0) {
      throw new AppError(
        'BUSINESS_RULE_VIOLATION',
        'Cannot delete template that is referenced by historical bill versions',
        422
      );
    }

    await client.query('DELETE FROM bill_template_dynamic_fields WHERE template_id = $1', [id]);
    await client.query('DELETE FROM bill_template_components WHERE template_id = $1', [id]);
    await client.query('DELETE FROM bill_template_assets WHERE template_id = $1', [id]);
    await client.query('DELETE FROM bill_templates WHERE id = $1', [id]);

    await createAudit(
      {
        entityType: 'BILL_TEMPLATE',
        entityId: id,
        action: 'DELETE',
        previousState: existing,
        userId
      },
      client
    );

    return { success: true, deleted: true };
  });
}

export async function uploadAsset(templateId: string, data: any, userId: string) {
  return withTransaction(async (client) => {
    // Verify template exists
    const tCheck = await client.query('SELECT id, name FROM bill_templates WHERE id = $1', [templateId]);
    if (tCheck.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Bill template not found', 404);
    }

    // Check file_name uniqueness for this template
    const fnCheck = await client.query(
      'SELECT id FROM bill_template_assets WHERE template_id = $1 AND file_name = $2',
      [templateId, data.file_name]
    );
    if (fnCheck.rowCount && fnCheck.rowCount > 0) {
      throw new AppError('CONFLICT', `Asset with filename "${data.file_name}" already exists for this template`, 409);
    }

    // Buffer preparation
    let fileBuffer: Buffer;
    if (data.file_content_base64) {
      fileBuffer = Buffer.from(data.file_content_base64, 'base64');
    } else {
      fileBuffer = Buffer.from(`ASSET_${data.asset_type}_${data.file_name}_${Date.now()}`);
    }

    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const safeFilename = data.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `templates/${templateId}/${crypto.randomUUID()}_${safeFilename}`;

    // Upload via storage service
    await storageService.upload(storageKey, Readable.from(fileBuffer));

    const mimeType = data.mime_type || (data.file_name.endsWith('.png') ? 'image/png' : 'image/jpeg');

    const aRes = await client.query(
      `INSERT INTO bill_template_assets
       (template_id, asset_type, file_name, storage_key, content_checksum, mime_type, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        templateId,
        data.asset_type,
        data.file_name,
        storageKey,
        checksum,
        mimeType,
        data.width ?? null,
        data.height ?? null
      ]
    );
    const asset = aRes.rows[0];

    await createAudit(
      {
        entityType: 'BILL_TEMPLATE_ASSET',
        entityId: asset.id,
        action: 'UPLOAD',
        newState: asset,
        userId
      },
      client
    );

    return asset;
  });
}

export async function getAssetFile(templateId: string, assetId: string) {
  const aRes = await query(
    'SELECT * FROM bill_template_assets WHERE id = $1 AND template_id = $2',
    [assetId, templateId]
  );
  if (aRes.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Template asset not found', 404);
  }
  const asset = aRes.rows[0];

  const stream = storageService.getStream(asset.storage_key);
  return {
    stream,
    mimeType: asset.mime_type || 'image/png',
    fileName: asset.file_name
  };
}

export async function deleteAsset(templateId: string, assetId: string, userId: string) {
  return withTransaction(async (client) => {
    const aRes = await client.query(
      'SELECT * FROM bill_template_assets WHERE id = $1 AND template_id = $2',
      [assetId, templateId]
    );
    if (aRes.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Template asset not found', 404);
    }
    const asset = aRes.rows[0];

    // Check if referenced in historical bill version snapshots
    const histCheck = await client.query(
      `SELECT id FROM bill_versions
       WHERE template_snapshot->'assets' @> jsonb_build_array(jsonb_build_object('storage_key', $1::text))
          OR template_snapshot::text LIKE ('%' || $1::text || '%')
       LIMIT 1`,
      [asset.storage_key]
    );

    const isReferencedInHistory = histCheck.rowCount && histCheck.rowCount > 0;

    await client.query('DELETE FROM bill_template_assets WHERE id = $1', [assetId]);

    // Only delete physical file from storage if not preserved in historical snapshots
    if (!isReferencedInHistory) {
      try {
        await storageService.delete(asset.storage_key);
      } catch (e) {
        // Ignored if file already removed or missing
      }
    }

    await createAudit(
      {
        entityType: 'BILL_TEMPLATE_ASSET',
        entityId: assetId,
        action: 'DELETE',
        previousState: asset,
        userId
      },
      client
    );

    return { success: true, deleted: true };
  });
}

export interface PreviewTemplateInput {
  template_id?: string;
  template_type?: string;
  layout_json?: any;
  components?: any[];
  dynamic_fields?: any[];
  sample_data?: any;
  format?: 'pdf' | 'json';
}

export async function previewTemplate(data: PreviewTemplateInput) {
  let layoutJson = data.layout_json || {};
  let components = data.components || [];
  let dynamicFields = data.dynamic_fields || [];
  let templateType = data.template_type || 'CONSOLIDATED';
  let assets: any[] = [];

  // If template_id provided, fetch existing template and overlay overrides
  if (data.template_id) {
    const existing = await getTemplateById(data.template_id);
    templateType = data.template_type || existing.template_type;
    layoutJson = { ...existing.layout_json, ...data.layout_json };
    components = (data.components && data.components.length > 0) ? data.components : (existing.components || []);
    dynamicFields = (data.dynamic_fields && data.dynamic_fields.length > 0) ? data.dynamic_fields : (existing.dynamic_fields || []);
    assets = existing.assets || [];
  }

  // Realistic sample data for transport billing preview
  const sampleData = data.sample_data || {
    bill: {
      bill_number: 'SRL/26-27/042',
      bill_date: new Date().toISOString().split('T')[0],
      billing_mode: templateType,
      status: 'GENERATED',
      financial_year: '2026-27',
      version_label: 'Version 1',
      line_count: 2,
      subtotal: 92000,
      tax_amount: 0,
      total_amount: 92000,
      paid_amount: 0,
      outstanding_balance: 92000
    },
    party: {
      name: 'Sample Logistics & Infra Private Limited',
      type: 'COMPANY',
      mobile: '9876543210',
      gstin: '24AABCS1429B1Z2',
      address: '101, Industrial Hub, Highway Road',
      city: 'Gandhidham',
      state: 'Gujarat',
      pincode: '370201'
    },
    trips: [
      {
        trip_number: 'TRP-2026-001',
        trip_date: '2026-04-10',
        route_origin: 'Mundra Port',
        route_destination: 'Jaipur Depot',
        vehicle_number: 'GJ-12-BT-1234',
        vehicle_relationship: 'MARKET',
        owner_name: 'Shri Ram Transport',
        freight_amount: 50000,
        detention_amount: 2000,
        total_freight: 52000,
        status: 'COMPLETED',
        pod_status: 'RECEIVED',
        destinations: [
          {
            sequence_no: 1,
            from_location: 'Mundra Port',
            to_location: 'Jaipur Depot',
            distance_km: 750,
            unloading_charge: 1500,
            unloading_charges: [
              { side: 'PARTY', amount: 1500 },
              { side: 'VEHICLE_OWNER', amount: 1200 }
            ]
          }
        ]
      },
      {
        trip_number: 'TRP-2026-002',
        trip_date: '2026-04-12',
        route_origin: 'Kandla',
        route_destination: 'Ahmedabad',
        vehicle_number: 'GJ-12-XY-9876',
        vehicle_relationship: 'OWN_FLEET',
        owner_name: 'SRL Own Fleet',
        freight_amount: 40000,
        detention_amount: 0,
        total_freight: 40000,
        status: 'COMPLETED',
        pod_status: 'RECEIVED',
        destinations: [
          {
            sequence_no: 1,
            from_location: 'Kandla',
            to_location: 'Ahmedabad',
            distance_km: 300,
            unloading_charge: 800,
            unloading_charges: [
              { side: 'PARTY', amount: 800 },
              { side: 'VEHICLE_OWNER', amount: 800 }
            ]
          }
        ]
      }
    ],
    items: [
      {
        sequence_no: 1,
        description: 'Trip TRP-2026-001 - Mundra Port to Jaipur Depot (GJ-12-BT-1234)',
        trip_number: 'TRP-2026-001',
        trip_date: '2026-04-10',
        route_origin: 'Mundra Port',
        route_destination: 'Jaipur Depot',
        vehicle_number: 'GJ-12-BT-1234',
        quantity: 1,
        unit_price: 52000,
        line_amount: 52000
      },
      {
        sequence_no: 2,
        description: 'Trip TRP-2026-002 - Kandla to Ahmedabad (GJ-12-XY-9876)',
        trip_number: 'TRP-2026-002',
        trip_date: '2026-04-12',
        route_origin: 'Kandla',
        route_destination: 'Ahmedabad',
        vehicle_number: 'GJ-12-XY-9876',
        quantity: 1,
        unit_price: 40000,
        line_amount: 40000
      }
    ]
  };

  if (data.format === 'json') {
    const resolved = resolveDynamicFields(
      sampleData.bill,
      sampleData.party,
      sampleData.trips,
      sampleData.items,
      []
    );
    return {
      format: 'json',
      template_type: templateType,
      layout_json: layoutJson,
      components,
      dynamic_fields: dynamicFields,
      resolved_dynamic_fields: resolved
    };
  }

  // Generate pure PDF-1.4 non-mutating preview
  const pdfData = {
    id: 'preview-draft',
    bill_number: sampleData.bill?.bill_number || 'SRL/26-27/042',
    bill_date: sampleData.bill?.bill_date || '2026-04-15',
    billing_mode: templateType,
    bill_status: 'PREVIEW',
    party_name: sampleData.party?.name || 'Sample Logistics & Infra Private Limited',
    party: sampleData.party,
    total_amount: sampleData.bill?.total_amount ?? 92000,
    paid_amount: sampleData.bill?.paid_amount ?? 0,
    balance_amount: sampleData.bill?.outstanding_balance ?? 92000,
    version_number: 1,
    version_label: 'Preview Draft',
    version_status: 'PREVIEW',
    template_snapshot: {
      template: { name: 'Preview Draft', template_type: templateType },
      layout: layoutJson,
      components,
      dynamic_fields: dynamicFields,
      assets
    },
    items: sampleData.items,
    trips: sampleData.trips,
    bill: sampleData.bill
  };

  const pdfBuffer = generateBillPdfBuffer(pdfData);
  return {
    format: 'pdf',
    buffer: pdfBuffer,
    mimeType: 'application/pdf',
    fileName: `preview_${templateType.toLowerCase()}.pdf`
  };
}

export interface ImportTemplateInput {
  file_name: string;
  file_content_base64: string;
  mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
}

export async function importTemplate(data: ImportTemplateInput) {
  const buffer = Buffer.from(data.file_content_base64, 'base64');
  if (buffer.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Uploaded file is empty', 400);
  }
  if (buffer.length > 10 * 1024 * 1024) {
    throw new AppError('VALIDATION_ERROR', 'Uploaded file exceeds 10MB limit', 400);
  }

  const isPdf = buffer.length >= 4 && buffer.slice(0, 4).toString('ascii') === '%PDF';
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  if (data.mime_type === 'application/pdf' && !isPdf) {
    throw new AppError('VALIDATION_ERROR', 'File content does not match PDF signature', 400);
  }
  if (data.mime_type === 'image/png' && !isPng) {
    throw new AppError('VALIDATION_ERROR', 'File content does not match PNG signature', 400);
  }
  if (data.mime_type === 'image/jpeg' && !isJpeg) {
    throw new AppError('VALIDATION_ERROR', 'File content does not match JPEG signature', 400);
  }

  const warnings: string[] = [];
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let extractedHeaderTitle = 'SHRI SANWARIYA ROAD LINES';
  let extractedSubtitle = 'FLEET OWNERS & TRANSPORT CONTRACTORS';

  if (isPdf) {
    const rawPdf = buffer.toString('binary');
    // Extract readable text tokens from PDF streams
    const textMatches = rawPdf.match(/\(([^()]{2,120})\)\s*Tj/g) || [];
    const textTokens: string[] = [];
    for (const tm of textMatches) {
      const match = tm.match(/\(([^()]+)\)\s*Tj/);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val && !/^[\x00-\x1F\x7F]+$/.test(val)) {
          textTokens.push(val);
        }
      }
    }

    if (textTokens.length >= 5) {
      confidence = 'HIGH';
      warnings.push('Vector PDF text streams extracted into draft components. Review dynamic field bindings.');
      // Look for title candidate
      const titleCandidate = textTokens.find((t) => /ROAD\s*LINES|TRANSPORT|LOGISTICS|INVOICE|BILL/i.test(t));
      if (titleCandidate) {
        extractedHeaderTitle = titleCandidate.toUpperCase();
      }
    } else {
      confidence = 'MEDIUM';
      warnings.push(
        'Scanned or raster PDF imported without vector text streams. Components were generated from standard transport bill layout heuristics. Please review and edit text labels.'
      );
    }
  } else {
    confidence = 'MEDIUM';
    warnings.push(
      'Raster image (JPG/PNG) imported. Layout components were generated from standard transport bill geometry. Please review and edit text labels and coordinates.'
    );
  }

  // Construct draft components based on SSRL transport bill geometry
  const draftComponents = [
    {
      component_type: 'HEADER',
      component_key: 'header_main',
      position_x: 20,
      position_y: 20,
      width: 555,
      height: 55,
      style_json: { font_size: 14, font_weight: 'bold', text_align: 'center', color: '#1E3A8A' },
      content_json: {
        text: extractedHeaderTitle,
        subtitle: extractedSubtitle
      }
    },
    {
      component_type: 'BORDER',
      component_key: 'header_divider',
      position_x: 20,
      position_y: 80,
      width: 555,
      height: 1,
      style_json: { stroke_color: '#3B82F6', stroke_width: 1.5 },
      content_json: {}
    },
    {
      component_type: 'TEXT',
      component_key: 'bill_meta',
      position_x: 20,
      position_y: 90,
      width: 270,
      height: 60,
      style_json: { font_size: 10, line_height: 14 },
      content_json: {
        template_text: 'Bill No: {{bill.bill_number}}\nDate: {{bill.bill_date}}\nMode: {{bill.billing_mode}}'
      }
    },
    {
      component_type: 'TEXT',
      component_key: 'party_details',
      position_x: 300,
      position_y: 90,
      width: 275,
      height: 60,
      style_json: { font_size: 10, line_height: 14 },
      content_json: {
        template_text: 'Billed To: {{party.name}}\nGSTIN: {{party.gstin}}\nAddress: {{party.address}}'
      }
    },
    {
      component_type: 'TABLE',
      component_key: 'trips_table',
      position_x: 20,
      position_y: 160,
      width: 555,
      height: 380,
      style_json: { header_bg_color: '#F1F5F9', border_color: '#CBD5E1', font_size: 9 },
      content_json: {
        is_repeatable: true,
        columns: [
          { key: 'sr_no', label: 'Sr', width: 25 },
          { key: 'trip_number', label: 'Trip No', width: 75 },
          { key: 'trip_date', label: 'Date', width: 65 },
          { key: 'vehicle_number', label: 'Vehicle No', width: 85 },
          { key: 'route', label: 'Route', width: 140 },
          { key: 'freight_amount', label: 'Freight (INR)', width: 80 },
          { key: 'line_amount', label: 'Total (INR)', width: 85 }
        ]
      }
    },
    {
      component_type: 'TEXT',
      component_key: 'bill_totals',
      position_x: 350,
      position_y: 560,
      width: 225,
      height: 70,
      style_json: { font_size: 10, text_align: 'right', font_weight: 'bold' },
      content_json: {
        template_text: 'Subtotal: {{bill.subtotal}}\nTax: {{bill.tax_amount}}\nTotal: {{bill.total_amount}}\nOutstanding: {{bill.outstanding_balance}}'
      }
    },
    {
      component_type: 'FOOTER',
      component_key: 'signatory_footer',
      position_x: 20,
      position_y: 650,
      width: 555,
      height: 50,
      style_json: { font_size: 9, color: '#64748B' },
      content_json: {
        text: 'Subject to local jurisdiction. This is a computer generated bill.',
        signatory_label: 'For SHRI SANWARIYA ROAD LINES - Authorised Signatory'
      }
    }
  ];

  const draftDynamicFields = [
    { binding_path: 'bill.bill_number', display_label: 'Bill Number', is_repeatable: false },
    { binding_path: 'bill.bill_date', display_label: 'Bill Date', is_repeatable: false },
    { binding_path: 'bill.billing_mode', display_label: 'Billing Mode', is_repeatable: false },
    { binding_path: 'party.name', display_label: 'Party Name', is_repeatable: false },
    { binding_path: 'party.gstin', display_label: 'Party GSTIN', is_repeatable: false },
    { binding_path: 'party.address', display_label: 'Party Address', is_repeatable: false },
    { binding_path: 'trips.trip_number', display_label: 'Trip Number', is_repeatable: true },
    { binding_path: 'trips.trip_date', display_label: 'Trip Date', is_repeatable: true },
    { binding_path: 'trips.vehicle_number', display_label: 'Vehicle Number', is_repeatable: true },
    { binding_path: 'trips.freight_amount', display_label: 'Freight Amount', is_repeatable: true },
    { binding_path: 'trips.line_amount', display_label: 'Line Amount', is_repeatable: true },
    { binding_path: 'bill.subtotal', display_label: 'Subtotal', is_repeatable: false },
    { binding_path: 'bill.total_amount', display_label: 'Total Amount', is_repeatable: false },
    { binding_path: 'bill.outstanding_balance', display_label: 'Outstanding Balance', is_repeatable: false }
  ];

  return {
    layout_json: {
      page_size: 'A4',
      orientation: 'PORTRAIT',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      primary_font: 'Helvetica',
      imported_file_name: data.file_name,
      imported_at: new Date().toISOString()
    },
    components: draftComponents,
    dynamic_fields: draftDynamicFields,
    warnings,
    confidence
  };
}
