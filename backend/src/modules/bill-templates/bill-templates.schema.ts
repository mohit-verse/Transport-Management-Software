import { z } from 'zod';

export const componentSchema = z.object({
  component_type: z.enum([
    'TEXT',
    'TABLE',
    'LINE',
    'BORDER',
    'IMAGE',
    'LOGO',
    'SIGNATURE',
    'STAMP',
    'HEADER',
    'FOOTER',
    'PAGE_BREAK',
    'REPEATABLE_SECTION',
    'REPEATABLE_ROW'
  ]),
  component_key: z.string().min(1).max(100),
  position_x: z.number().nullable().optional(),
  position_y: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  style_json: z.record(z.any()).optional().default({}),
  content_json: z.record(z.any()).optional().default({})
});

export const dynamicFieldBindingSchema = z.object({
  field_definition_id: z.string().uuid(),
  binding_path: z.string().min(1).max(200),
  display_label: z.string().max(200).nullable().optional(),
  is_repeatable: z.boolean().optional().default(false),
  default_value: z.string().nullable().optional()
});

export const listTemplatesSchema = z.object({
  query: z.object({
    template_type: z.enum(['INDIVIDUAL', 'CONSOLIDATED', 'MULTI_PAGE']).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  }).optional()
});

export const createTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    template_type: z.enum(['INDIVIDUAL', 'CONSOLIDATED', 'MULTI_PAGE']),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().default('DRAFT'),
    layout_json: z.record(z.any()).optional().default({}),
    components: z.array(componentSchema).optional().default([]),
    dynamic_fields: z.array(dynamicFieldBindingSchema).optional().default([])
  })
});

export const updateTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    template_type: z.enum(['INDIVIDUAL', 'CONSOLIDATED', 'MULTI_PAGE']).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
    layout_json: z.record(z.any()).optional(),
    components: z.array(componentSchema).optional(),
    dynamic_fields: z.array(dynamicFieldBindingSchema).optional()
  })
});

export const uploadAssetSchema = z.object({
  body: z.object({
    asset_type: z.enum(['LOGO', 'SIGNATURE', 'STAMP', 'IMAGE']),
    file_name: z.string().min(1).max(200),
    file_content_base64: z.string().optional(),
    mime_type: z.string().max(100).optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional()
  })
});

export const previewTemplateSchema = z.object({
  body: z.object({
    template_id: z.string().uuid().optional(),
    template_type: z.enum(['INDIVIDUAL', 'CONSOLIDATED', 'MULTI_PAGE']).optional().default('CONSOLIDATED'),
    layout_json: z.record(z.any()).optional().default({}),
    components: z.array(componentSchema).optional().default([]),
    dynamic_fields: z.array(dynamicFieldBindingSchema).optional().default([]),
    sample_data: z.record(z.any()).optional(),
    format: z.enum(['pdf', 'json']).optional().default('pdf')
  })
});

export const importTemplateSchema = z.object({
  body: z.object({
    file_name: z.string().min(1).max(255),
    file_content_base64: z.string().min(1),
    mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png'])
  })
});

