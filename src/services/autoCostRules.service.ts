import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { AutomaticCostRule, ShipmentType } from '../types/database';

export interface AutoCostRulePayload {
  name?: string | null;
  brand?: string | null;
  tonnage_min?: number | null;
  tonnage_max?: number | null;
  tonnage_label?: string | null;
  equipment?: string | null;
  m3?: number | null;
  shipment_method?: ShipmentType | null;
  model_patterns: string[];
  ocean_usd?: number | null;
  gastos_pto_cop?: number | null;
  flete_cop?: number | null;
  notes?: string | null;
  active?: boolean;
}

export async function listAutoCostRules() {
  return apiGet<AutomaticCostRule[]>('/api/auto-costs');
}

export async function createAutoCostRule(payload: AutoCostRulePayload) {
  return apiPost<AutomaticCostRule>('/api/auto-costs', payload);
}

export async function updateAutoCostRule(id: string, payload: AutoCostRulePayload) {
  return apiPut<AutomaticCostRule>(`/api/auto-costs/${id}`, payload);
}

export async function deleteAutoCostRule(id: string) {
  return apiDelete(`/api/auto-costs/${id}`);
}

export async function suggestAutoCostRule(params: {
  model: string;
  brand?: string | null;
  shipment?: string | null;
  tonnage?: number | null;
}) {
  const query = new URLSearchParams();
  query.set('model', params.model);
  if (params.brand) query.set('brand', params.brand);
  if (params.shipment) query.set('shipment', params.shipment);
  if (params.tonnage !== undefined && params.tonnage !== null) {
    query.set('tonnage', String(params.tonnage));
  }
  return apiGet<AutomaticCostRule>(`/api/auto-costs/suggest?${query.toString()}`);
}

export async function applyAutoCostRule(payload: {
  purchase_id: string;
  model: string;
  brand?: string | null;
  shipment?: string | null;
  tonnage?: number | null;
  force?: boolean;
}) {
  return apiPost<{ rule: AutomaticCostRule; updates: any }>('/api/auto-costs/apply', payload);
}

