// Nombre del sistema y contacto de soporte en los correos al titular.
// Configurables por despliegue; por omisión, los del proyecto original.
//   EMAIL_BRAND_NAME      p. ej. «Verificación de credenciales digitales · Universidad de Guadalajara»
//   EMAIL_SUPPORT_ADDRESS correo de soporte que aparece en el mensaje
export function emailBrand(env: Record<string, string | undefined> = process.env) {
  return {
    name: env.EMAIL_BRAND_NAME?.trim() || 'Certo',
    support: env.EMAIL_SUPPORT_ADDRESS?.trim() || 'hello@schroedinger-hat.org',
  }
}
