// ==================== ENUMS Y TIPOS ====================

export type UserRole =
  | 'sebastian'
  | 'eliana'
  | 'gerencia'
  | 'admin'
  | 'importaciones'
  | 'logistica'
  | 'comerciales'
  | 'jefe_comercial'
  | 'servicio'
  | 'pagos'
  | 'comercial123';

export type AuctionStatus = 'GANADA' | 'PERDIDA' | 'PENDIENTE';

export type PurchaseType = 'SUBASTA' | 'COMPRA_DIRECTA';

export type PaymentStatus = 'PENDIENTE' | 'DESBOLSADO' | 'COMPLETADO';

export type SalesState = 'OK' | 'X' | 'BLANCO';

export type Currency = 'USD' | 'COP' | 'JPY' | 'EUR';

export type Incoterm = 'EXW' | 'FOB' | 'CIF';

export type ShipmentType = 'RORO' | '1X40' | '1X20' | 'LCL' | 'AEREO' | 'LOLO';

export type CostItemType = 'INLAND' | 'GASTOS_PTO' | 'FLETE' | 'TRASLD' | 'REPUESTOS' | 'MANT_EJEC';

export type CurrencyPair = 'USD/JPY' | 'USD/COP' | 'USD/EUR' | 'EUR/USD' | 'JPY/USD';

export type PreselectionDecision = 'PENDIENTE' | 'SI' | 'NO';

export type MachineCondition = 'NUEVO' | 'USADO';

export type MachineType =
  | 'EXCAVADORA'
  | 'CARGADOR'
  | 'MINICARGADOR'
  | 'MINIEXCAVADORA'
  | 'MOTONIVELADORA'
  | 'RETROCARGADOR'
  | 'SOLDADOR'
  | 'TRACTOR'
  | 'PARTE'
  | 'OTROS'
  | 'BULLDOZER'
  | 'CRAWLER'
  | 'MINI CARGADOR'
  | 'MINI EXCAVADORA'
  | 'PARTS'
  | 'VIBRO COMPACTADOR'
  | 'WELDER';

/** SI/No para campos binarios (wet_line, blade, etc.) */
export type WetLineType = 'SI' | 'No' | null;

/** Tipo de brazo en máquinas */
export type ArmTypeValue = 'ESTANDAR' | 'N/A' | 'LONG ARM' | null;

/** Campos que pueden venir como número o string desde API/Excel */
export type NumberOrStringNull = number | string | null;

// ==================== TABLAS ====================

// 1. USERS
export interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// 2. SUPPLIERS
export interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 3. MACHINES
export interface Machine {
  id: string;
  brand: string | null; // Marca o fabricante (ej: CAT, KOMATSU, HITACHI)
  model: string;
  serial: string;
  year: number;
  hours: number;
  drive_folder_id: string | null;
  // Especificaciones técnicas
  machine_type: MachineType | null;
  wet_line: WetLineType;
  arm_type: ArmTypeValue;
  track_width: number | null;
  bucket_capacity: number | null;
  warranty_months: number | null;
  warranty_hours: number | null;
  engine_brand: 'N/A' | 'ISUZU' | 'MITSUBISHI' | 'FPT' | 'YANMAR' | 'KUBOTA' | 'PERKINS' | 'CUMMINS' | 'CATERPILLAR' | 'KOMATSU' | null;
  cabin_type: 'N/A' | 'CABINA CERRADA / AIRE ACONDICIONADO' | 'CANOPY' | null;
  blade: WetLineType;
  capacidad?: 'MINIS' | 'MEDIANAS' | 'GRANDES' | null;
  tonelage?: '1.7-5.5 TONELADAS' | '7.5-13.5 TONELADAS' | '20.0-ADELANTE TONELADAS' | null;
  created_at: string;
  updated_at: string;
}

// 4. PRESELECTIONS (Preselección - visible por Sebastián y Gerencia)
export type PreselectionCabinType = 'CABINA CERRADA/AC' | 'CANOPY' | 'CABINA CERRADA' | 'CABINA CERRADA / AIRE ACONDICIONADO' | null;

export interface Preselection {
  id: string;
  supplier_name: string;
  auction_date: string; // fecha de la subasta
  lot_number: string;
  brand: string | null;
  model: string;
  serial: string;
  year: number | null;
  hours: number | null;
  suggested_price: number | null; // precio sugerido
  auction_url: string | null; // URL de la subasta online
  decision: PreselectionDecision; // PENDIENTE, SI, NO
  transferred_to_auction: boolean; // indica si ya se pasó a subastas
  auction_id: string | null; // ID de la subasta creada
  comments: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  transferred_at: string | null;
  // Nuevos campos para experiencia inline y layout enriquecido
  auction_name?: string | null;
  auction_type?: string | null;
  auction_country?: string | null;
  currency?: string | null;
  location?: string | null;
  final_price?: number | null;
  local_time?: string | null;
  auction_city?: string | null;
  colombia_time?: string | null;
  shoe_width_mm?: number | null; // ancho de zapatas en mm
  spec_pip?: boolean | null;
  spec_blade?: boolean | null;
  spec_pad?: string | null; // PAD: 'Bueno' o 'Malo'
  spec_cabin?: PreselectionCabinType;
  arm_type?: ArmTypeValue;
  auction_status?: AuctionStatus | null;
  auction_id_generated?: string | null;
  auction_price_bought?: number | null;
  machine_type?: MachineType | null;
}

// 5. AUCTIONS (Subastas - visible solo por Sebastián y Gerencia)
export interface Auction {
  id: string;
  date: string; // fecha de la subasta
  lot: string; // número de lote
  machine_id: string;
  price_max: number; // precio máximo de puja
  supplier_id: string;
  supplier_name?: string | null;
  price_bought: number | null; // precio de compra final
  purchase_type: PurchaseType; // SUBASTA o COMPRA_DIRECTA
  auction_type?: string | null; // Tipo de subasta (viene de preselections)
  location?: string | null; // Ubicación (se sincroniza a purchases)
  status: AuctionStatus; // GANADA, PERDIDA, PENDIENTE
  epa?: 'SI' | 'NO' | null; // Entrada Provisional Aduanera
  comments: string | null;
  photos_folder_id: string | null; // ID de carpeta de Google Drive
  created_by: string; // user_id de Sebastián
  created_at: string;
  updated_at: string;
}

// 6. NEW_PURCHASES (Compras Nuevos - visible por Jefe Comercial, Gerencia y Admin)
export interface NewPurchase {
  id: string;
  mq: string; // Código único de máquina
  type: string; // COMPRA DIRECTA por defecto
  shipment: string | null; // Tipo de embarque
  supplier_name: string; // Proveedor
  condition: MachineCondition; // NUEVO o USADO (NUEVO por defecto)
  brand: string | null; // Marca
  model: string; // Modelo (requerido)
  serial: string; // Serial (requerido)
  purchase_order: string | null; // Orden de compra
  invoice_number: string | null; // Número de factura
  invoice_date: string | null; // Fecha de factura
  payment_date: string | null; // Fecha de pago
  machine_location: string | null; // Ubicación de la máquina
  incoterm: string | null; // Incoterm
  currency: string; // Moneda (USD por defecto)
  port_of_loading: string | null; // Puerto de embarque
  shipment_departure_date: string | null; // Fecha embarque salida
  shipment_arrival_date: string | null; // Fecha embarque llegada
  value: number | null; // Valor
  shipping_costs: number | null; // FLETES
  finance_costs: number | null; // FINANCE
  // VALOR TOTAL se calcula como value + shipping_costs + finance_costs
  mc: string | null; // Código de movimiento
  synced_to_equipment_id: string | null; // ID del equipo sincronizado
  // Nuevas columnas: TIPO EQUIPO y SPEC
  equipment_type: string | null; // Tipo de equipo
  cabin_type: string | null; // TIPO CABINA
  wet_line: string | null; // LINEA HUMEDA (SI/NO)
  dozer_blade: string | null; // HOJA TOPADORA (SI/NO)
  track_type: string | null; // TIPO ZAPATA
  track_width: string | null; // ANCHO ZAPATA
  due_date: string | null; // FECHA VENCIMIENTO
  purchase_order_pdf_path: string | null; // Ruta del PDF de orden de compra masiva
  year: number | null; // Año de la máquina
  port_of_embarkation: string | null; // Puerto de embarque
  nationalization_date: string | null; // Fecha de nacionalización
  usd_jpy_rate: number | null; // Contravalor (USD/JPY rate)
  trm_rate: number | null; // TRM (Tasa Representativa del Mercado)
  empresa: string | null; // Empresa
  payment_term: string | null; // Término de pago para el PDF (ej: "120 days after the BL date")
  description: string | null; // Descripción del equipo (se muestra en columna DESCRIPTION del PDF)
  created_by: string;
  created_at: string;
  updated_at: string;
  machine_type?: MachineType | null;
  arm_type?: ArmTypeValue;
}

// 7. PURCHASES (Compras - visible solo por Eliana y Gerencia)
export interface Purchase {
  id: string;
  machine_id: string;
  auction_id: string | null;
  supplier_id: string;
  incoterm: Incoterm; // EXW o FOB
  invoice_number: string | null;
  invoice_date: string | null;
  due_date?: string | null; // Fecha de vencimiento de factura
  empresa?: string | null; // Empresa (Partequipos/Maquitecno)
  currency: Currency; // JPY, USD, etc.
  exw_value: number; // valor EXW
  fob_additional: number; // adicionales para FOB
  disassembly_load: number; // costo de desmontaje y carga
  disassembly_cost: number; // alias de disassembly_load
  fob_value: number; // calculado automáticamente: exw + fob_additional + disassembly_load
  usd_jpy_rate: number | null; // tasa USD/JPY
  usd_rate: number; // tasa USD general
  jpy_rate: number | null; // tasa JPY
  trm: number; // tasa representativa del mercado (COP)
  payment_date: string | null;
  shipment_type: ShipmentType | null; // RORO, 1X40, etc.
  port_of_shipment: string | null;
  payment_status: PaymentStatus; // PENDIENTE, DESBOLSADO, COMPLETADO
  comments: string | null;
  mc: string | null; // Código de movimiento
  condition: MachineCondition; // NUEVO o USADO (USADO por defecto para purchases)
  created_by: string; // Eliana
  created_at: string;
  updated_at: string;
  departure_date: string | null; // deprecated - ahora en shipping
  estimated_arrival_date: string | null; // deprecated - ahora en shipping
  purchase_order?: string | null;
  location?: string | null;
  currency_type?: string | null;
  port_of_embarkation?: string | null;
  supplier_name?: string | null;
  shipment_type_v2?: string | null;
  mq?: string | null;
  pending_marker?: boolean;
  shipment_departure_date?: string | null;
  shipment_arrival_date?: string | null;
  nationalization_date?: string | null;
  port_of_destination?: string | null;
  current_movement?: string | null;
  current_movement_date?: string | null;
  current_movement_plate?: string | null;
  valor_factura_proveedor?: string | null;
  observaciones_pagos?: string | null;
  pendiente_a?: string | null;
  fecha_vto_fact?: string | null;
  exw_value_formatted?: string | null;
  fob_expenses?: number | null;
  disassembly_load_value?: number | null;
  fob_total?: number | null;
  trm_rate?: number | null;
  trm_display?: string | null;
  purchase_type?: PurchaseType | null;
  cpd?: string | null;
  sales_reported?: string | null;
  commerce_reported?: string | null;
  luis_lemus_reported?: string | null;
  envio_originales?: boolean | null;
  cu?: string | null; // Consecutivo Único para agrupar compras
  epa?: 'SI' | 'NO' | null; // Entrada Provisional Aduanera (sincronizado desde auctions)
  total_valor_girado?: number | null; // Total Valor Girado (suma de los 3 pagos desde pagos)
  comentarios_servicio?: string | null; // Comentarios de servicio (sincronizado a service_records.comentarios)
  comentarios_comercial?: string | null; // Comentarios comerciales (sincronizado a equipments.commercial_observations)
  ocean_pagos?: number | null;
  trm_ocean?: number | null;
  auction_price_bought?: number | null; // Precio compra editable en COMPRA DIRECTA
  machine_type?: MachineType | null; // Alias desde machines.machine_type
}

// 6. COST_ITEMS (Costos adicionales)
export interface CostItem {
  id: string;
  purchase_id: string;
  type: CostItemType; // INLAND, GASTOS_PTO, FLETE, TRASLD, REPUESTOS, MANT_EJEC
  amount: number;
  currency: Currency;
  created_at: string;
}

// 6b. AUTOMATIC_COST_RULES (Maestro de gastos automáticos)
export interface AutomaticCostRule {
  id: string;
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
  active: boolean;
  created_at: string;
  updated_at: string;
}

// 7. SHIPPING (Envío)
export interface Shipping {
  id: string;
  purchase_id: string;
  departure_date: string | null;
  estimated_arrival: string | null; // calculado automáticamente: departure + 45 días
  actual_arrival: string | null;
  carrier: string | null; // transportista
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

// 8. CURRENCY_RATES (Tasas de cambio)
export interface CurrencyRate {
  id: string;
  date: string;
  pair: CurrencyPair; // USD/JPY, USD/COP, etc.
  rate: number;
  source: string | null; // fuente de la tasa
  created_at: string;
}

// 9. MANAGEMENT_TABLE (Consolidado Gerencia - "AA2025" digital)
export interface ManagementRecord {
  id: string;
  machine_id: string;
  auction_id: string | null;
  purchase_id: string | null;
  machine_type?: MachineType | null;
  sales_state: SalesState | null; // OK, X, BLANCO
  tipo_compra: PurchaseType | null; // traído de auctions.purchase_type
  tipo_incoterm: Incoterm | null; // traído de purchases.incoterm
  currency: Currency | null;
  tasa: number | null; // traído de currency_rates o purchases.usd_jpy_rate
  precio_fob: number | null;
  inland: number | null;
  cif_usd: number | null;
  cif_local: number | null;
  gastos_pto: number | null;
  flete: number | null;
  trasld: number | null;
  rptos: number | null; // repuestos
  mant_ejec: number | null; // mantenimiento ejecutado
  cost_total_arancel: number | null;
  proyectado: number | null;
  pvp_est: number | null; // precio de venta público estimado
  comentarios_pc: string | null;
  created_at: string;
  updated_at: string;
  // Campos deprecated (mantener para compatibilidad)
  total_fob_old?: number;
  total_cif_old?: number;
  total_costs_old?: number;
  projected_value_old?: number;
  estimated_pvp_old?: number;
  sales_status?: string;
  final_comments_old?: string;
}

// 10. NOTIFICATIONS
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

// 11. MACHINE_MOVEMENTS
export interface MachineMovement {
  id: string;
  purchase_id: string;
  movement_description: string;
  movement_date: string; // DATE
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ==================== TIPOS CON RELACIONES ====================

export interface PreselectionWithRelations extends Preselection {
  created_by_user?: UserProfile;
  auction?: Auction; // Subasta generada (si decision=SI)
}

export interface AuctionWithRelations extends Auction {
  machine?: Machine;
  supplier?: Supplier;
  created_by_user?: UserProfile;
  preselection?: Preselection; // Preselección origen (si viene de preselección)
  // Aliases del backend
  auction_date?: string;
  lot_number?: string;
  max_price?: number;
  purchased_price?: number | null;
  currency?: string | null; // Moneda desde purchase o preselection
}

export interface PurchaseWithRelations extends Purchase {
  machine?: Machine;
  supplier?: Supplier;
  auction?: Auction;
  cost_items?: CostItem[];
  shipping?: Shipping;
  created_by_user?: UserProfile;
  // Campos sincronizados desde machines (JOIN en backend)
  model?: string;
  serial?: string;
  brand?: string;
  year?: number;
  hours?: number;
  // Precio de compra de la subasta relacionada
  auction_price_bought?: number | null;
  // Campos de valor CIF y verificaciones (API/backend)
  cif_usd?: number | null;
  cif_usd_verified?: boolean | null;
  fob_total_verified?: boolean | null;
}

export interface ManagementRecordWithRelations extends ManagementRecord {
  machine?: Machine;
  auction?: AuctionWithRelations;
  purchase?: PurchaseWithRelations;
}

// ==================== VISTAS ====================

export interface AuctionComplete {
  // Campos de auction
  id: string;
  date: string;
  lot: string;
  machine_id: string;
  price_max: number;
  supplier_id: string;
  price_bought: number | null;
  purchase_type: PurchaseType;
  status: AuctionStatus;
  comments: string | null;
  photos_folder_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Campos relacionados
  model: string;
  serial: string;
  year: number;
  hours: number;
  supplier_name: string;
  created_by_name: string;
}

export interface PurchaseComplete {
  // Campos de purchase
  id: string;
  machine_id: string;
  auction_id: string | null;
  supplier_id: string;
  incoterm: Incoterm;
  invoice_number: string | null;
  invoice_date: string;
  currency: Currency;
  exw_value: number;
  fob_additional: number;
  disassembly_load: number;
  fob_value: number;
  usd_jpy_rate: number | null;
  usd_rate: number;
  jpy_rate: number | null;
  trm: number;
  payment_date: string | null;
  shipment_type: ShipmentType | null;
  port_of_shipment: string | null;
  payment_status: PaymentStatus;
  comments: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Campos relacionados
  model: string;
  serial: string;
  year: number;
  hours: number;
  supplier_name: string;
  created_by_name: string;
  departure_date: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
}

export interface ManagementConsolidado {
  // Campos de management_table
  id: string;
  machine_id: string;
  auction_id: string | null;
  purchase_id: string | null;
  machine_type?: MachineType | null;
  sales_state: SalesState | null;
  tipo_compra: PurchaseType | null;
  tipo_incoterm: Incoterm | null;
  currency: Currency | null;
  tasa: number | null;
  precio_fob: number | null;
  inland: number | null;
  cif_usd: number | null;
  cif_local: number | null;
  gastos_pto: number | null;
  flete: number | null;
  trasld: number | null;
  rptos: number | null;
  mant_ejec: number | null;
  cost_total_arancel: number | null;
  proyectado: number | null;
  pvp_est: number | null;
  comentarios_pc: string | null;
  created_at: string;
  updated_at: string;
  // Campos relacionados
  model: string;
  serial: string;
  year: number;
  auction_date: string | null;
  auction_status: AuctionStatus | null;
  invoice_number: string | null;
  invoice_date: string | null;
}

// ==================== TIPOS DE FORMULARIOS ====================

export interface AuctionFormData {
  date: string;
  lot: string;
  machine_id: string;
  price_max: number;
  supplier_id: string;
  price_bought?: number;
  purchase_type: PurchaseType;
  status: AuctionStatus;
  comments?: string;
  photos_folder_id?: string;
}

export interface PurchaseFormData {
  machine_id: string;
  auction_id?: string;
  supplier_id: string;
  incoterm: Incoterm;
  invoice_number?: string;
  invoice_date: string;
  currency: Currency;
  exw_value: number;
  fob_additional?: number;
  disassembly_load?: number;
  usd_jpy_rate?: number;
  usd_rate: number;
  jpy_rate?: number;
  trm: number;
  payment_date?: string;
  shipment_type?: ShipmentType;
  port_of_shipment?: string;
  payment_status: PaymentStatus;
  comments?: string;
}

export interface MachineFormData {
  model: string;
  serial: string;
  year: number;
  hours: number;
  drive_folder_id?: string;
}

export interface SupplierFormData {
  name: string;
  contact_email?: string;
  phone?: string;
  notes?: string;
}

export interface CostItemFormData {
  purchase_id: string;
  type: CostItemType;
  amount: number;
  currency: Currency;
}

export interface ShippingFormData {
  purchase_id: string;
  departure_date?: string;
  estimated_arrival?: string;
  actual_arrival?: string;
  carrier?: string;
  tracking_number?: string;
}

// ==================== TIPOS DE FILTROS ====================

export interface AuctionFilters {
  status?: AuctionStatus;
  purchase_type?: PurchaseType;
  supplier_id?: string;
  date_from?: string;
  date_to?: string;
  created_by?: string;
}

export interface PurchaseFilters {
  payment_status?: PaymentStatus;
  incoterm?: Incoterm;
  supplier_id?: string;
  currency?: Currency;
  invoice_date_from?: string;
  invoice_date_to?: string;
}

export interface ManagementFilters {
  sales_state?: SalesState;
  tipo_compra?: PurchaseType;
  tipo_incoterm?: Incoterm;
  currency?: Currency;
}

// 12. EQUIPMENTS
export interface Equipment {
  id: string;
  purchase_id: string;
  supplier_name: string | null;
  model: string | null;
  serial: string | null;
  shipment_departure_date: string | null;
  shipment_arrival_date: string | null;
  port_of_destination: string | null;
  nationalization_date: string | null;
  current_movement: string | null;
  current_movement_date: string | null;
  year: number | null;
  hours: number | null;
  pvp_est: number | null;
  comments: string | null;
  full_serial: number | null;
  state: 'Libre' | 'Ok dinero y OC' | 'Lista, Pendiente Entrega' | 'Reservada';
  machine_type: MachineType | null;
  wet_line: WetLineType;
  arm_type: ArmTypeValue;
  track_width: number | null;
  bucket_capacity: number | null;
  warranty_months: number | null;
  warranty_hours: number | null;
  engine_brand: 'N/A' | 'ISUZU' | 'MITSUBISHI' | 'FPT' | 'YANMAR' | 'KUBOTA' | 'PERKINS' | 'CUMMINS' | 'CATERPILLAR' | 'KOMATSU' | null;
  cabin_type: 'N/A' | 'CABINA CERRADA / AIRE ACONDICIONADO' | 'CANOPY' | null;
  blade: WetLineType;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// SERVICE
export interface ServiceRecord {
  id: string;
  purchase_id: string;
  machine_id?: string | null;
  supplier_name: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  shipment_departure_date: string | null;
  shipment_arrival_date: string | null;
  port_of_destination: string | null;
  nationalization_date: string | null;
  mc: string | null;
  current_movement: string | null;
  current_movement_date: string | null;
  year: number | null;
  hours: number | null;
  start_staging: string | null;
  end_staging: string | null;
  condition: MachineCondition | null; // NUEVO o USADO
  comentarios?: string | null; // Comentarios de servicio (sincronizado desde purchases.comentarios_servicio)
  created_at: string;
  updated_at: string;
  machine_type?: MachineType | null;
  mq?: string | null;
  service_value?: number | null;
  staging_type?: string | null;
  repuestos?: NumberOrStringNull;
  new_purchase_id?: string | null;
  np_track_width?: NumberOrStringNull;
  track_width?: NumberOrStringNull;
  np_cabin_type?: string | null;
  cabin_type?: string | null;
  np_wet_line?: string | null;
  wet_line?: string | null;
  np_dozer_blade?: string | null;
  np_track_type?: string | null;
  np_arm_type?: string | null;
  arm_type?: string | null;
  spec_pad?: string | null;
  shoe_width_mm?: NumberOrStringNull;
  spec_cabin?: string | null;
  machine_arm_type?: string | null;
  spec_pip?: boolean | null;
  spec_blade?: boolean | null;
  blade?: string | null;
}

// ==================== TIPOS DE RESPUESTA ====================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Machine Specification Defaults
export interface MachineSpecDefault {
  id: string;
  brand: string;
  model: string;
  capacidad?: 'MINIS' | 'MEDIANAS' | 'GRANDES' | null;
  tonelage?: '1.7-5.5 TONELADAS' | '7.5-13.5 TONELADAS' | '20.0-ADELANTE TONELADAS' | null;
  spec_blade?: boolean | null;
  spec_pip?: boolean | null;
  spec_cabin?: PreselectionCabinType | null;
  arm_type?: ArmTypeValue;
  shoe_width_mm?: number | null;
  created_at: string;
  updated_at: string;
}
