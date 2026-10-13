import { CANONICAL_DYNAMIC_FIELDS, CanonicalDynamicField } from './dynamic-fields.definitions';

export interface DynamicFieldContext {
  party?: Record<string, any>;
  bill?: Record<string, any>;
  billing?: Record<string, any>;
  trip?: Record<string, any>;
  vehicle?: Record<string, any>;
  vehicle_owner?: Record<string, any>;
  journey?: Record<string, any>;
  destinations?: Array<Record<string, any>>;
  receivables?: Record<string, any>;
  vehicle_owner_payables?: Record<string, any>;
  own_fleet_expenses?: Record<string, any>;
  pod?: Record<string, any>;
  issues?: Array<Record<string, any>> | Record<string, any>;
  payment?: Record<string, any>;
  system?: Record<string, any>;
  calculated?: Record<string, any>;
  items?: Array<Record<string, any>>;
  financials?: Record<string, any>;
  side?: 'PARTY' | 'VEHICLE_OWNER';
}

/**
 * Deterministic Indian Numbering System currency-to-words converter
 * Rounds to 2 decimal places. Handles zero, negative amounts, paise, thousands, lakhs, crores.
 */
export function amountToWordsINR(amount: any): string {
  if (amount === null || amount === undefined || amount === '') return 'Zero Rupees Only';
  const num = Number(amount);
  if (isNaN(num)) return 'Zero Rupees Only';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const rounded = Math.round(absNum * 100) / 100;
  if (rounded === 0) return 'Zero Rupees Only';

  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return units[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return tens[t] + (u > 0 ? ' ' + units[u] : '');
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let res = '';
    if (h > 0) res += units[h] + ' Hundred';
    if (r > 0) res += (res ? ' ' : '') + convertTwoDigits(r);
    return res;
  }

  function convertInteger(n: number): string {
    if (n === 0) return '';
    const crores = Math.floor(n / 10000000);
    let rem = n % 10000000;
    const lakhs = Math.floor(rem / 100000);
    rem = rem % 100000;
    const thousands = Math.floor(rem / 1000);
    const rest = rem % 1000;

    const parts: string[] = [];
    if (crores > 0) parts.push(convertInteger(crores) + ' Crore');
    if (lakhs > 0) parts.push(convertTwoDigits(lakhs) + ' Lakh');
    if (thousands > 0) parts.push(convertTwoDigits(thousands) + ' Thousand');
    if (rest > 0) parts.push(convertThreeDigits(rest));
    return parts.join(' ');
  }

  let rupeesText = '';
  if (rupees > 0) {
    rupeesText = convertInteger(rupees) + (rupees === 1 ? ' Rupee' : ' Rupees');
  }

  let paiseText = '';
  if (paise > 0) {
    paiseText = convertTwoDigits(paise) + ' Paise';
  }

  let result = '';
  if (rupeesText && paiseText) {
    result = rupeesText + ' and ' + paiseText + ' Only';
  } else if (rupeesText) {
    result = rupeesText + ' Only';
  } else if (paiseText) {
    result = paiseText + ' Only';
  } else {
    result = 'Zero Rupees Only';
  }

  return (isNegative ? 'Minus ' : '') + result;
}

/**
 * Format helper for Currency values: INR XX,XXX.XX
 */
export function formatCurrency(amount: any): string {
  if (amount === null || amount === undefined || amount === '') return 'INR 0.00';
  const num = Number(amount);
  if (isNaN(num)) return 'INR 0.00';
  return 'INR ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format helper for Dates: YYYY-MM-DD
 */
export function formatDate(dateVal: any): string {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toISOString().split('T')[0];
  } catch {
    return String(dateVal);
  }
}

/**
 * Format helper for Booleans: Yes / No
 */
export function formatBoolean(val: any): string {
  if (val === true || val === 'true' || val === 1) return 'Yes';
  if (val === false || val === 'false' || val === 0) return 'No';
  return '-';
}

/**
 * Format helper for Numbers
 */
export function formatNumber(val: any): string {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toLocaleString('en-IN');
}

/**
 * Builds the canonical field lookup map
 */
const CANONICAL_FIELD_MAP = new Map<string, CanonicalDynamicField>();
for (const f of CANONICAL_DYNAMIC_FIELDS) {
  CANONICAL_FIELD_MAP.set(`${f.source_entity.toLowerCase()}.${f.field_key.toLowerCase()}`, f);
}

/**
 * Normalize alias prefixes: e.g. bill.* -> billing.*
 */
function normalizeBindingPath(path: string): string {
  const trimmed = path.trim().toLowerCase();
  if (trimmed.startsWith('bill.')) {
    return 'billing.' + trimmed.slice(5);
  }
  return trimmed;
}

/**
 * Resolves a single field path against context
 */
export function resolveFieldValue(bindingPath: string, context: DynamicFieldContext, rowContext?: Record<string, any>): string {
  const normalized = normalizeBindingPath(bindingPath);

  // Check row-level context first for repeatable table rows / repeatable sections
  if (rowContext) {
    if (rowContext[normalized] !== undefined) {
      return formatGenericValue(rowContext[normalized], normalized);
    }
    if (rowContext[bindingPath] !== undefined) {
      return formatGenericValue(rowContext[bindingPath], bindingPath);
    }

    if (normalized === 'journey.unloading_charge' || normalized === 'unloading_charge') {
      const targetSide = rowContext.side || context.side || (context.vehicle_owner && !context.party ? 'VEHICLE_OWNER' : 'PARTY');
      if (rowContext.unloading_charge !== undefined && typeof rowContext.unloading_charge !== 'object') {
        return formatCurrency(rowContext.unloading_charge);
      }
      if (targetSide === 'PARTY' && rowContext.party_unloading_charge !== undefined) {
        return formatCurrency(rowContext.party_unloading_charge);
      }
      if (targetSide === 'VEHICLE_OWNER' && (rowContext.vehicle_owner_unloading_charge !== undefined || rowContext.owner_unloading_charge !== undefined)) {
        return formatCurrency(rowContext.vehicle_owner_unloading_charge ?? rowContext.owner_unloading_charge);
      }
      if (Array.isArray(rowContext.unloading_charges)) {
        const match = rowContext.unloading_charges.find((uc: any) => uc.side === targetSide);
        if (match) return formatCurrency(match.amount);
      }
      const destId = rowContext.id || rowContext.trip_destination_id;
      if (destId) {
        const ucs = context.financials?.unloading_charges || context.trip?.financials?.unloading_charges;
        if (Array.isArray(ucs)) {
          const match = ucs.find((uc: any) => (uc.trip_destination_id === destId || uc.id === destId) && uc.side === targetSide);
          if (match) return formatCurrency(match.amount);
        }
      }
      return formatCurrency(0);
    }
  }

  // Row aliases: item.* or row.*
  if (rowContext && (normalized.startsWith('item.') || normalized.startsWith('row.'))) {
    const subKey = normalized.split('.')[1];
    if (rowContext[subKey] !== undefined) {
      return formatGenericValue(rowContext[subKey], normalized);
    }
  }

  const parts = normalized.split('.');
  if (parts.length < 2) {
    return '';
  }

  const [entity, key] = parts;
  const canonicalField = CANONICAL_FIELD_MAP.get(normalized);

  // System fields
  if (entity === 'system') {
    if (key === 'current_date') {
      return formatDate(new Date());
    }
    if (key === 'generated_at') {
      return new Date().toISOString();
    }
  }

  // Billing fields
  if (entity === 'billing') {
    const billingSource = context.billing || context.bill || {};
    let val = billingSource[key];
    if (val === undefined && key === 'financial_year_code') {
      val = billingSource.financial_year?.code || billingSource.financial_year_code;
    }
    const dataType = canonicalField?.data_type || (key.includes('amount') || key.includes('total') || key.includes('balance') ? 'CURRENCY' : 'STRING');
    return formatTypedValue(val, dataType, key);
  }

  // Party fields
  if (entity === 'party') {
    const party = context.party || {};
    let val = party[key];
    if (val === undefined && key === 'full_address') {
      val = party.address || party.full_address;
    }
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Trip fields
  if (entity === 'trip') {
    const trip = context.trip || (context.items && context.items[0]) || {};
    const val = trip[key];
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Vehicle fields
  if (entity === 'vehicle') {
    const vehicle = context.vehicle || context.trip || (context.items && context.items[0]) || {};
    const val = vehicle[key];
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Vehicle Owner fields
  if (entity === 'vehicle_owner') {
    const vo = context.vehicle_owner || {};
    const val = vo[key];
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Journey fields
  if (entity === 'journey') {
    const journey = context.journey || (context.destinations && context.destinations[0]) || context.trip || {};
    let val = journey[key];
    if (key === 'unloading_charge') {
      const targetSide = context.side || (context.vehicle_owner && !context.party ? 'VEHICLE_OWNER' : 'PARTY');
      if (val === undefined || typeof val === 'object') {
        if (targetSide === 'PARTY' && journey.party_unloading_charge !== undefined) {
          val = journey.party_unloading_charge;
        } else if (targetSide === 'VEHICLE_OWNER' && (journey.vehicle_owner_unloading_charge !== undefined || journey.owner_unloading_charge !== undefined)) {
          val = journey.vehicle_owner_unloading_charge ?? journey.owner_unloading_charge;
        } else if (Array.isArray(journey.unloading_charges)) {
          const match = journey.unloading_charges.find((uc: any) => uc.side === targetSide);
          if (match) val = match.amount;
        } else {
          const destId = journey.id || journey.trip_destination_id;
          const ucs = context.financials?.unloading_charges || context.trip?.financials?.unloading_charges;
          if (Array.isArray(ucs)) {
            if (destId) {
              const match = ucs.find((uc: any) => (uc.trip_destination_id === destId || uc.id === destId) && uc.side === targetSide);
              if (match) val = match.amount;
            } else {
              const forSide = ucs.filter((uc: any) => uc.side === targetSide);
              if (forSide.length > 0) val = forSide[0].amount;
            }
          }
        }
      }
      return formatCurrency(val ?? 0);
    }
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Receivables fields
  if (entity === 'receivables') {
    const rec = context.receivables || context.trip || {};
    const val = rec[key];
    return formatTypedValue(val, canonicalField?.data_type || 'CURRENCY');
  }

  // Payables fields
  if (entity === 'vehicle_owner_payables') {
    const pay = context.vehicle_owner_payables || {};
    const val = pay[key];
    return formatTypedValue(val, canonicalField?.data_type || 'CURRENCY');
  }

  // Own fleet expense fields
  if (entity === 'own_fleet_expenses') {
    const of = context.own_fleet_expenses || {};
    const val = of[key];
    return formatTypedValue(val, canonicalField?.data_type || 'CURRENCY');
  }

  // POD fields
  if (entity === 'pod') {
    const pod = context.pod || context.trip || {};
    const val = pod[key];
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Issues fields
  if (entity === 'issues') {
    const issue = Array.isArray(context.issues) ? context.issues[0] : context.issues || {};
    const val = issue[key];
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Payment fields
  if (entity === 'payment') {
    const payment = context.payment || context.bill || context.billing || {};
    let val = payment[key];
    if (val === undefined && key === 'total_paid') val = payment.paid_amount;
    if (val === undefined && key === 'outstanding_balance') val = payment.balance_amount;
    return formatTypedValue(val, canonicalField?.data_type || 'STRING');
  }

  // Calculated fields
  if (entity === 'calculated') {
    const calc = context.calculated || context.billing || context.bill || {};
    let val = calc[key];
    if (key === 'amount_in_words') {
      if (val && typeof val === 'string' && val.trim().length > 0) {
        return val;
      }
      const targetAmount = calc.total_amount ?? calc.grand_total ?? calc.total_freight ?? context.billing?.total_amount ?? context.bill?.total_amount ?? 0;
      return amountToWordsINR(targetAmount);
    }
    if (val === undefined && key === 'total_freight') val = calc.total_amount;
    if (val === undefined && key === 'balance_payable') val = calc.balance_amount;
    return formatTypedValue(val, canonicalField?.data_type || 'CURRENCY');
  }

  return '';
}

function formatTypedValue(val: any, dataType: string, key?: string): string {
  if (val === null || val === undefined || val === '') return '-';
  if (dataType === 'CURRENCY') {
    return formatCurrency(val);
  }
  if (dataType === 'DATE') {
    return formatDate(val);
  }
  if (dataType === 'BOOLEAN') {
    return formatBoolean(val);
  }
  if (dataType === 'NUMBER') {
    return formatNumber(val);
  }
  if (dataType === 'JSON') {
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  }
  if (key && (key.includes('amount') || key.includes('freight') || key.includes('charge') || key.includes('price') || key.includes('total') || key.includes('balance'))) {
    if (!isNaN(Number(val))) {
      return formatCurrency(val);
    }
  }
  return String(val);
}

function formatGenericValue(val: any, key: string): string {
  if (val === null || val === undefined || val === '') return '-';
  if (key.includes('amount') || key.includes('freight') || key.includes('charge') || key.includes('price')) {
    return formatCurrency(val);
  }
  if (key.includes('date')) {
    return formatDate(val);
  }
  return String(val);
}

/**
 * Replaces all {{binding.path}} placeholders in a text string
 */
export function resolveTextTemplate(templateText: string, context: DynamicFieldContext, rowContext?: Record<string, any>): string {
  if (!templateText) return '';
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    return resolveFieldValue(path, context, rowContext);
  });
}

/**
 * Resolves all canonical dynamic fields against the provided context
 */
export function resolveDynamicFields(
  bill?: Record<string, any>,
  party?: Record<string, any>,
  trips?: Array<Record<string, any>>,
  items?: Array<Record<string, any>>,
  payments?: Array<Record<string, any>>,
  options?: { side?: 'PARTY' | 'VEHICLE_OWNER' }
): Record<string, string> {
  const context: DynamicFieldContext = {
    bill,
    billing: bill,
    party,
    trip: trips && trips.length > 0 ? trips[0] : undefined,
    items,
    destinations: trips && trips[0]?.destinations ? trips[0].destinations : undefined,
    financials: trips && trips[0]?.financials ? trips[0].financials : undefined,
    payment: payments && payments.length > 0 ? payments[0] : undefined,
    side: options?.side || 'PARTY'
  };

  const result: Record<string, string> = {};
  for (const field of CANONICAL_DYNAMIC_FIELDS) {
    const path = `${field.source_entity.toLowerCase()}.${field.field_key}`;
    result[path] = resolveFieldValue(path, context);
  }
  return result;
}
