// Texto que sustituye el nombre del titular cuando decidió ocultarlo en la
// verificación pública y en el certificado. Configurable por despliegue
// (HIDDEN_RECIPIENT_NAME); no forma parte de la credencial firmada.
export const DEFAULT_HIDDEN_RECIPIENT_NAME = 'Titular verificado por la Universidad de Guadalajara'

export function hiddenRecipientName(env: Record<string, string | undefined> = process.env): string {
  return env.HIDDEN_RECIPIENT_NAME?.trim() || DEFAULT_HIDDEN_RECIPIENT_NAME
}
