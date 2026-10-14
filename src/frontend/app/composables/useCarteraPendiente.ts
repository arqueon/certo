import { apiClient } from '~/api/api-client'

// Una cartera nueva que espera «Sí, es mía» (14-oct-2026). El aviso vive en
// todo el portal, no solo en el diálogo donde se generó el código: la persona
// suele estar en la cartera, vuelve al portal por cualquier página y ahí debe
// encontrarlo sin recargar. Se consulta al entrar, al volver a la pestaña y,
// mientras haya un código vigente generado aquí, cada pocos segundos.
export interface CarteraPendiente {
  offerId: number
  credentialId: string | null
  credentialName: string | null
  client: 'web' | 'app' | null
  name: string | null
  requestedAt: string
  expiresAt: string
}

const CLAVE_OFERTA = 'mc-oferta-cartera-hasta'
const INTERVALO = 4000

function leerVigencia(): number {
  try { return Number(localStorage.getItem(CLAVE_OFERTA) || 0) }
  catch { return 0 }
}

export function useCarteraPendiente() {
  const pendientes = useState<CarteraPendiente[]>('mc-carteras-pendientes', () => [])
  // Sube cada vez que la persona decide: los diálogos abiertos se refrescan.
  const version = useState<number>('mc-carteras-version', () => 0)
  const decidiendo = useState<boolean>('mc-carteras-decidiendo', () => false)
  const resultado = useState<'approved' | 'refused' | null>('mc-carteras-resultado', () => null)
  const fallo = useState<boolean>('mc-carteras-fallo', () => false)

  async function consultar() {
    try {
      const respuesta = await apiClient.get<{ data: CarteraPendiente[] }>('/api/holder/wallet-pending')
      pendientes.value = respuesta.data || []
      if (pendientes.value.length) { resultado.value = null }
    }
    catch { /* sin sesión o sin red: el aviso simplemente no aparece */ }
  }

  /** Lo llama el diálogo al generar un código: el aviso se vigila hasta que venza. */
  function vigilarHasta(expiresAt: string) {
    try { localStorage.setItem(CLAVE_OFERTA, String(Date.parse(expiresAt) || 0)) }
    catch { /* almacenamiento bloqueado: se consulta al volver a la pestaña */ }
  }

  async function decidir(offerId: number, approve: boolean) {
    decidiendo.value = true; fallo.value = false
    try {
      await apiClient.post(`/api/holder/wallet-offers/${offerId}/decision`, { approve })
      resultado.value = approve ? 'approved' : 'refused'
      pendientes.value = pendientes.value.filter(p => p.offerId !== offerId)
      version.value++
      return true
    }
    catch { fallo.value = true; return false }
    finally { decidiendo.value = false; void consultar() }
  }

  return { pendientes, version, decidiendo, resultado, fallo, consultar, vigilarHasta, decidir }
}

/**
 * Arranca la vigilancia global (una sola vez, desde el diseño del portal):
 * al montar, al volver a la pestaña y, mientras haya un código vigente, cada
 * INTERVALO. Sin código vigente no hay consultas periódicas.
 */
export function useVigilanciaCarteras(activa: Ref<boolean>) {
  const { consultar } = useCarteraPendiente()
  const route = useRoute()
  let reloj: ReturnType<typeof setInterval> | undefined
  function tic() {
    if (!activa.value || document.visibilityState !== 'visible') { return }
    if (leerVigencia() > Date.now()) { void consultar() }
  }
  function alVolver() {
    if (activa.value && document.visibilityState === 'visible') { void consultar() }
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    reloj = setInterval(tic, INTERVALO)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', alVolver)
    window.removeEventListener('focus', alVolver)
    if (reloj) { clearInterval(reloj) }
  })
  watch(activa, (valor) => { if (valor) { void consultar() } }, { immediate: true })
  watch(() => route.fullPath, () => { if (activa.value) { void consultar() } })
}
