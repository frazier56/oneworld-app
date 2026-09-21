const hostKeys = new Set(['arrendador_nombre', 'arrendador_doc_tipo', 'arrendador_doc', 'arrendador_direccion']);
const listingKeys = new Set(['direccion', 'ciudad', 'canon', 'deposito']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const editableKeys = new Set(['arrendatario_doc_tipo', 'area', 'dias_aviso', 'dias_habiles_pago', 'dias_devolucion', 'sancion', 'canon_renovacion', 'servicios_incluidos', 'garantia_tipo', 'garantia_detalle', 'rc_aseguradora', 'rc_limite', 'electrodomestico', 'fecha_instalacion', 'aporte_arrendatario', 'reembolso', 'valor_limpieza', 'frecuencia_limpieza', 'check_in', 'check_out', 'politica_cancelacion']);
/** Drafts may contain old versions' merge tokens; only restore actual editable, nonsensitive fields. */
export function agreementDraftFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, v]) => editableKeys.has(key) && typeof v === 'string'));
}
export function agreementDestination(key: string, requestLinked: boolean): { screen: 'host' | 'listing' | 'guest' | 'field'; target: string } {
  if (hostKeys.has(key)) return { screen: 'host', target: key };
  if (listingKeys.has(key)) return { screen: 'listing', target: key === 'canon' || key === 'deposito' ? 'price' : 'where' };
  if (requestLinked && key === 'arrendatario_nombre') return { screen: 'guest', target: 'guest-identity' };
  if (key === 'fecha_fin' || key === 'duracion') return { screen: 'field', target: 'duracion' };
  return { screen: 'field', target: key };
}

/** Only return to the same property's agreement. Never accept an origin, hash, or unrelated route. */
export function agreementReturnPath(value: string | null, propertyId: string | null | undefined): string | null {
  if (!value || !propertyId || !uuid.test(propertyId)) return null;
  const [pathname, query = '', ...extra] = value.split('?');
  if (extra.length || pathname !== `/rentals/r/${propertyId}/contract` || value.includes('#') || value.includes('\\')) return null;
  const params = new URLSearchParams(query);
  for (const [key, v] of params) {
    if (params.getAll(key).length !== 1) return null;
    if (key === 'request' ? !uuid.test(v) : key !== 'edit' || v !== '1') return null;
  }
  return pathname + (params.size ? `?${params.toString()}` : '');
}
