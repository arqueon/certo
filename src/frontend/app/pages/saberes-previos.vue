<script setup lang="ts">
import type { SolicitudSaberes } from '~/composables/useSaberesPrevios'
import SolicitudTitular from '~/components/saberes/SolicitudTitular.vue'
import SolicitudTitularB from '~/components/saberes/SolicitudTitularB.vue'
const branding = useBranding()
const { t } = useI18n()
const route = useRoute()
// Con marca, la página va en la dirección B y sus textos en es/en; sin marca,
// se conserva la página original, solo en español.
definePageMeta({ temaB: true })
const txt = (clave: string, original: string, params?: Record<string, unknown>) => branding.active ? t(`portal.b.saberes.${clave}`, params) : original
const { request, enabled: portalTitularEnabled, loginUrl } = useSaberesPrevios()
useHead({ title: () => txt('title', 'Reconocimiento de saberes previos'), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const sesion = ref<{ nombre: string; correo: string; correoVerificado: boolean } | null>(null)
const cargando = ref(true)
const error = ref('')
const mensaje = ref('')
const catalogo = ref<any[]>([])
const instancias = ref<{ clave: string; nombre: string }[]>([])
const solicitudes = ref<SolicitudSaberes[]>([])
const ficha = ref<any>(null)
const cargandoFicha = ref(false)
const pagina = ref(1)
const enviando = ref(false)
const relecturaPendiente = ref(false)
const envioIncierto = ref(false)
const pendiente = ref<{ data: Record<string, string>; key: string } | null>(null)
const esperarHasta = ref(0)
const ahora = ref(Date.now())
const esperaSegundos = computed(() => Math.max(0, Math.ceil((esperarHasta.value - ahora.value) / 1000)))
let reloj: ReturnType<typeof setInterval> | undefined
onUnmounted(() => { if (reloj) clearInterval(reloj) })
const datos = reactive({ nombreCompleto: '', matricula: '', claveLogro: '', instancia: '', descripcionSaberes: '', evidencias: '', fechaLogro: '', solicitudAnterior: '' })
let fichaPeticion = 0
watch(() => datos.claveLogro, async (clave) => {
  const numero = ++fichaPeticion; ficha.value = null
  datos.solicitudAnterior = ''
  if (!clave) { cargandoFicha.value = false; return }
  cargandoFicha.value = true
  try {
    const r = await request(`catalogo-publico/${encodeURIComponent(clave)}`)
    if (numero === fichaPeticion) ficha.value = r.data
  } catch { if (numero === fichaPeticion) error.value = txt('fichaError', 'No se pudo consultar la ficha. Vuelve a seleccionarla antes de enviar.') }
  finally { if (numero === fichaPeticion) cargandoFicha.value = false }
})
async function listar(numero = pagina.value) {
  const r = await request(`solicitudes-saberes?pagina=${numero}`)
  solicitudes.value = r.data; pagina.value = numero; relecturaPendiente.value = false
}
async function cargar() {
  cargando.value = true; error.value = ''
  try {
    sesion.value = (await request('sesion')).data
    if (!datos.nombreCompleto) datos.nombreCompleto = sesion.value!.nombre
    const [c, i] = await Promise.all([request('catalogo-publico'), request('instancias')])
    catalogo.value = c.data; instancias.value = i.data
    await listar()
  } catch (e: any) {
    if ((e.statusCode || e.status) === 401) sesion.value = null
    else error.value = txt('errLoad', 'No pudimos cargar esta sección. Vuelve a intentarlo en unos momentos.')
  } finally { cargando.value = false }
}
async function cambiarPagina(numero: number) {
  try { await listar(numero) } catch { error.value = txt('errList', 'No pudimos actualizar tus solicitudes. Vuelve a intentarlo.') }
}
function actualizar(s: SolicitudSaberes) {
  solicitudes.value = solicitudes.value.map(actual => actual.referencia === s.referencia ? s : actual)
}
async function nueva(s?: SolicitudSaberes) {
  if (enviando.value || envioIncierto.value) return
  datos.solicitudAnterior = ''
  if (s) {
    datos.claveLogro = s.logro.clave; datos.instancia = s.instancia || ''
    datos.descripcionSaberes = s.descripcionSaberes; datos.evidencias = s.evidencias || ''
    datos.matricula = s.matricula || ''; datos.fechaLogro = s.fechaLogro || ''
    datos.nombreCompleto = s.solicitanteNombre || sesion.value?.nombre || ''
    await nextTick(); datos.solicitudAnterior = s.referencia
  }
  document.getElementById('formulario-saberes')?.scrollIntoView({ behavior: 'smooth' })
  document.getElementById(branding.active ? (s ? 'descripcion-saberes' : 'ficha-saberes') : 'nombre-saberes')?.focus({ preventScroll: true })
}
async function enviar(reintento = false) {
  if (enviando.value || esperaSegundos.value || (envioIncierto.value && !reintento) || !sesion.value?.correoVerificado) return
  enviando.value = true; error.value = ''; mensaje.value = ''
  try {
    if (!reintento || !pendiente.value) pendiente.value = {
      data: Object.fromEntries(Object.entries(datos).filter(([, value]) => value !== '')), key: crypto.randomUUID(),
    }
    const result = await request<{ data: SolicitudSaberes }>('solicitudes-saberes', pendiente.value.data, pendiente.value.key)
    pendiente.value = null; envioIncierto.value = false; relecturaPendiente.value = false
    mensaje.value = txt('sent', 'Tu solicitud quedó registrada. Consulta su estado y la fecha de respuesta en «Mis solicitudes».')
    solicitudes.value = [result.data, ...solicitudes.value.filter(s => s.referencia !== result.data.referencia)].slice(0, 25)
    pagina.value = 1
    datos.descripcionSaberes = ''; datos.evidencias = ''; datos.solicitudAnterior = ''; datos.fechaLogro = ''
    try { await listar(1) } catch { mensaje.value += txt('sentPartial', ' La lista no pudo actualizarse completa; tu envío sí quedó confirmado.') }
  } catch (e: any) {
    const status = e.statusCode || e.status
    error.value = status === 401 ? txt('errSession', 'Tu sesión terminó. Copia lo escrito antes de volver a entrar con tu cuenta.')
      : e.data?.error?.message || txt('errUncertain', 'No pudimos confirmar si tu solicitud quedó registrada. Conservamos lo escrito.')
    if (status === 429) {
      esperarHasta.value = Date.now() + (Number(e.data?.error?.retryAfter) || 600) * 1000
    }
    if (!status || status >= 500 || status === 409 || status === 429) {
      envioIncierto.value = true; relecturaPendiente.value = true
      try { await listar(1) } catch { error.value += txt('errStillList', ' Aún no pudimos consultar la lista.') }
    } else { pendiente.value = null; envioIncierto.value = false }
  } finally { enviando.value = false }
}
async function salir() {
  try { await request('auth/salir', {}); sesion.value = null; solicitudes.value = []; ficha.value = null }
  catch { error.value = txt('errLeave', 'No pudimos cerrar la sesión. Vuelve a intentarlo.') }
}
onMounted(async () => {
  if (!portalTitularEnabled) return
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
  await cargar()
  if (route.query.acceso === 'fallido') error.value = txt('errAccess', 'No se pudo comprobar el acceso a tu cuenta. Vuelve a entrar; si continúa el problema, pide ayuda al soporte de tu cuenta.')
})
</script>

<template>
  <div v-if="portalTitularEnabled && branding.active" class="mc-saberes">
    <section class="mc-saberes__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor">
        <p class="mc-etiqueta">
          {{ t('portal.b.saberes.eyebrow') }}
        </p>
        <h1 class="mc-titulo">
          {{ t('portal.b.saberes.title') }}
        </h1>
        <p class="mc-saberes__intro">
          {{ t('portal.b.saberes.intro', { brand: branding.name }) }}
        </p>
      </div>
    </section>

    <div class="mc-contenedor mc-saberes__cuerpo">
      <section class="mc-tarjeta mc-saberes__como" aria-labelledby="saberes-como">
        <h2 id="saberes-como" class="mc-titulo">
          {{ t('portal.b.saberes.howTitle') }}
        </h2>
        <ol>
          <li v-for="n in 4" :key="n">
            <span aria-hidden="true">{{ n }}</span>{{ t(`portal.b.saberes.step${n}`) }}
          </li>
        </ol>
      </section>

      <div v-if="cargando" class="mc-saberes__esqueleto mc-tarjeta" role="status" :aria-label="t('portal.b.saberes.loading')" />

      <section v-else-if="!sesion && !error" class="mc-tarjeta mc-saberes__bloque" data-testid="saberes-entrar">
        <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-lock-closed" /></span>
        <h2 class="mc-titulo">
          {{ t('portal.b.saberes.loginTitle') }}
        </h2>
        <p class="mc-suave">
          {{ t('portal.b.saberes.loginText') }}
        </p>
        <a class="mc-boton" :href="loginUrl">{{ t('portal.b.saberes.loginButton') }}</a>
      </section>

      <template v-else-if="sesion">
        <section class="mc-saberes__cuenta" :aria-label="sesion.nombre">
          <p>
            <strong>{{ sesion.nombre }}</strong> <span class="mc-suave">{{ sesion.correo }}</span>
            <span v-if="sesion.correoVerificado" class="mc-chip mc-chip--ok">{{ t('portal.b.saberes.accountVerified') }}</span>
          </p>
          <div class="mc-saberes__acciones">
            <a :href="loginUrl" class="mc-boton mc-boton--texto">{{ t('portal.b.saberes.renew') }}</a>
            <button type="button" class="mc-boton mc-boton--texto" @click="salir">
              {{ t('portal.b.saberes.leave') }}
            </button>
          </div>
        </section>
        <div v-if="!sesion.correoVerificado" class="mc-aviso mc-aviso--esp" data-testid="saberes-verificar">
          <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-envelope" /></span>
          <div class="mc-saberes__nota">
            <p><strong>{{ t('portal.b.saberes.verifyTitle') }}</strong></p>
            <p>{{ t('portal.b.saberes.verifyText') }}</p>
            <a :href="loginUrl" class="mc-boton mc-boton--secundario">{{ t('portal.b.saberes.verifyDone') }}</a>
          </div>
        </div>

        <section class="mc-saberes__mias" aria-labelledby="mis-solicitudes">
          <div class="mc-saberes__titulo-lista">
            <h2 id="mis-solicitudes" class="mc-titulo">
              {{ t('portal.b.saberes.mineTitle') }}
            </h2>
            <button type="button" class="mc-boton mc-boton--texto" :disabled="enviando" @click="cambiarPagina(pagina)">
              <span class="i-heroicons-arrow-path" aria-hidden="true" /> {{ t('portal.b.saberes.refresh') }}
            </button>
          </div>
          <div v-if="!solicitudes.length" class="mc-tarjeta mc-saberes__vacio" data-testid="saberes-vacio">
            <p class="mc-suave">
              {{ t('portal.b.saberes.mineEmpty') }}
            </p>
          </div>
          <SolicitudTitularB v-for="s in solicitudes" :key="s.referencia" :solicitud="s" :correo-verificado="sesion.correoVerificado" @actualizar="actualizar" @nueva="nueva" />
          <nav v-if="pagina > 1 || solicitudes.length >= 25" class="mc-saberes__paginas" :aria-label="t('portal.b.saberes.pages')">
            <button type="button" class="mc-boton mc-boton--secundario" :disabled="pagina <= 1 || enviando" @click="cambiarPagina(pagina - 1)">
              {{ t('portal.b.saberes.prev') }}
            </button>
            <span>{{ t('portal.b.saberes.page', { n: pagina }) }}</span>
            <button type="button" class="mc-boton mc-boton--secundario" :disabled="solicitudes.length < 25 || pagina >= 999999 || enviando" @click="cambiarPagina(pagina + 1)">
              {{ t('portal.b.saberes.next') }}
            </button>
          </nav>
        </section>

        <section id="formulario-saberes" class="mc-tarjeta mc-saberes__formulario" aria-labelledby="nueva-saberes">
          <h2 id="nueva-saberes" class="mc-titulo">
            {{ datos.solicitudAnterior ? t('portal.b.saberes.newAgain') : t('portal.b.saberes.newTitle') }}
          </h2>
          <form @submit.prevent="enviar()">
            <fieldset :disabled="enviando || envioIncierto">
              <div class="mc-saberes__parte">
                <h3><span aria-hidden="true">1</span>{{ t('portal.b.saberes.part1') }}</h3>
                <label class="mc-campo">
                  <span>{{ t('portal.b.saberes.ficha') }}</span>
                  <select id="ficha-saberes" v-model="datos.claveLogro" required>
                    <option value="" disabled>{{ t('portal.b.saberes.fichaChoose') }}</option>
                    <option v-for="c in catalogo" :key="c.clave" :value="c.clave">{{ c.nombre }}</option>
                  </select>
                </label>
                <p v-if="!catalogo.length" class="mc-suave">
                  {{ t('portal.b.saberes.fichaNone') }}
                </p>
                <p v-if="cargandoFicha" class="mc-suave" role="status">
                  {{ t('portal.b.saberes.fichaLoading') }}
                </p>
                <div v-if="ficha" class="mc-saberes__ficha" data-testid="saberes-ficha">
                  <h4 class="mc-titulo">
                    {{ ficha.nombre }}
                  </h4>
                  <p v-if="ficha.proposito">
                    {{ ficha.proposito }}
                  </p>
                  <p v-if="ficha.resultadoAprendizaje">
                    <strong>{{ t('portal.b.saberes.demonstrate') }}:</strong> {{ ficha.resultadoAprendizaje }}
                  </p>
                  <ul v-if="(ficha.resultadosAprendizaje || []).length" class="mc-saberes__resultados">
                    <li v-for="(r, n) in ficha.resultadosAprendizaje" :key="n">
                      <span class="i-heroicons-check-circle" aria-hidden="true" />{{ r.enunciado }}
                    </li>
                  </ul>
                  <p v-if="ficha.perfilIngreso">
                    <strong>{{ t('portal.b.saberes.audience') }}:</strong> {{ ficha.perfilIngreso }}
                  </p>
                  <p v-if="ficha.requisitosIngreso">
                    <strong>{{ t('portal.b.saberes.requirements') }}:</strong> {{ ficha.requisitosIngreso }}
                  </p>
                  <p v-if="ficha.contextoAplicacion">
                    <strong>{{ t('portal.b.saberes.context') }}:</strong> {{ ficha.contextoAplicacion }}
                  </p>
                  <div v-for="(e, n) in ficha.evidencias || []" :key="n" class="mc-saberes__evidencia">
                    <h5>{{ e.nombre }}</h5>
                    <p>{{ e.descripcion }}</p>
                    <p v-if="e.rubrica?.criterios?.length" class="mc-suave">
                      {{ t('portal.b.saberes.criteriaHelp') }}
                    </p>
                    <details v-for="(c, j) in e.rubrica?.criterios || []" :key="j">
                      <summary>{{ c.nombre }}</summary>
                      <p>{{ c.descripcion }}</p>
                      <p v-if="c.ponderacion != null">
                        {{ t('portal.b.saberes.weight', { n: c.ponderacion }) }}
                      </p>
                      <p v-if="e.rubrica.regla?.criteriosEliminatorios?.includes(c.codigo)">
                        <strong>{{ t('portal.b.saberes.eliminatory') }}</strong>
                      </p>
                      <p v-for="(nivel, k) in c.nivelesDesempeno || []" :key="k">
                        <strong>{{ nivel.nombre }}:</strong> {{ nivel.descriptor }}<span v-if="nivel.puntos != null"> ({{ t(nivel.puntos === 1 ? 'portal.b.saberes.point' : 'portal.b.saberes.points', { n: nivel.puntos }) }})</span>
                      </p>
                      <p v-if="e.rubrica.regla?.nivelMinimoPorCriterio != null">
                        {{ t('portal.b.saberes.minLevel', { level: c.nivelesDesempeno?.find((nivel: any) => nivel.nivel === e.rubrica.regla.nivelMinimoPorCriterio)?.nombre || e.rubrica.regla.nivelMinimoPorCriterio }) }}
                      </p>
                    </details>
                    <p v-if="e.rubrica?.regla?.puntajeMinimo != null">
                      {{ t('portal.b.saberes.minScore', { n: e.rubrica.regla.puntajeMinimo }) }}
                    </p>
                    <p v-if="e.rubrica?.regla?.notaRegla">
                      {{ e.rubrica.regla.notaRegla }}
                    </p>
                  </div>
                </div>
                <label class="mc-campo">
                  <span>{{ t('portal.b.saberes.instancia') }}</span>
                  <select v-model="datos.instancia" required>
                    <option value="" disabled>{{ t('portal.b.saberes.instanciaChoose') }}</option>
                    <option v-for="i in instancias" :key="i.clave" :value="i.clave">{{ i.nombre }}</option>
                  </select>
                </label>
                <p v-if="!instancias.length" class="mc-suave">
                  {{ t('portal.b.saberes.instanciaNone') }}
                </p>
              </div>

              <div class="mc-saberes__parte">
                <h3><span aria-hidden="true">2</span>{{ t('portal.b.saberes.part2') }}</h3>
                <label class="mc-campo">
                  <span>{{ t('portal.b.saberes.descripcion') }}</span>
                  <textarea id="descripcion-saberes" v-model="datos.descripcionSaberes" required maxlength="20000" rows="6" aria-describedby="ayuda-descripcion" />
                  <small id="ayuda-descripcion">{{ t('portal.b.saberes.descripcionHelp') }}</small>
                </label>
                <label class="mc-campo">
                  <span>{{ t('portal.b.saberes.evidencias') }}</span>
                  <textarea v-model="datos.evidencias" maxlength="20000" rows="4" aria-describedby="ayuda-evidencias" />
                  <small id="ayuda-evidencias">{{ t('portal.b.saberes.evidenciasHelp') }}</small>
                </label>
                <label class="mc-campo mc-saberes__corto">
                  <span>{{ t('portal.b.saberes.fechaLogro') }}</span>
                  <input v-model="datos.fechaLogro" type="date">
                </label>
              </div>

              <div class="mc-saberes__parte">
                <h3><span aria-hidden="true">3</span>{{ t('portal.b.saberes.part3') }}</h3>
                <div class="mc-saberes__dos">
                  <label class="mc-campo">
                    <span>{{ t('portal.b.saberes.nombre') }}</span>
                    <input id="nombre-saberes" v-model="datos.nombreCompleto" required maxlength="255" autocomplete="name">
                  </label>
                  <label class="mc-campo">
                    <span>{{ t('portal.b.saberes.matricula') }}</span>
                    <input v-model="datos.matricula" maxlength="100">
                  </label>
                </div>
              </div>

              <div class="mc-saberes__enviar">
                <p class="mc-suave">
                  {{ t('portal.b.saberes.check') }}
                </p>
                <p class="mc-suave">
                  {{ t('portal.b.saberes.deadline') }}
                </p>
                <button class="mc-boton" data-testid="saberes-presentar" :disabled="!sesion.correoVerificado || !ficha || !instancias.length || esperaSegundos > 0">
                  {{ enviando ? t('portal.b.saberes.sending') : t('portal.b.saberes.submit') }}
                </button>
              </div>
            </fieldset>
          </form>
          <div v-if="envioIncierto" class="mc-aviso mc-aviso--esp" role="status">
            <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-exclamation-triangle" /></span>
            <div class="mc-saberes__nota">
              <p>{{ t('portal.b.saberes.uncertainText') }}</p>
              <p v-if="esperaSegundos">
                {{ t('portal.b.saberes.wait', { n: esperaSegundos }) }}
              </p>
              <div class="mc-saberes__acciones">
                <button type="button" class="mc-boton" :disabled="enviando || esperaSegundos > 0" @click="enviar(true)">
                  {{ t('portal.b.saberes.retry') }}
                </button>
                <button v-if="relecturaPendiente" type="button" class="mc-boton mc-boton--secundario" @click="cambiarPagina(1)">
                  {{ t('portal.b.saberes.recheck') }}
                </button>
                <button v-else type="button" class="mc-boton mc-boton--secundario" @click="envioIncierto = false; pendiente = null; datos.descripcionSaberes = ''; datos.evidencias = ''; datos.solicitudAnterior = ''">
                  {{ t('portal.b.saberes.closeNotice') }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>
      <div v-if="error" class="mc-aviso mc-aviso--no" role="alert">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-exclamation-triangle" /></span>
        <div class="mc-saberes__nota">
          <p>{{ error }}</p>
          <button type="button" class="mc-boton mc-boton--secundario" @click="cargar">
            {{ t('portal.b.saberes.reload') }}
          </button>
        </div>
      </div>
      <div v-if="mensaje" class="mc-aviso mc-aviso--ok" role="status">
        <span class="mc-aviso__icono" aria-hidden="true"><span class="i-heroicons-check-circle" /></span>
        <p>{{ mensaje }}</p>
      </div>
    </div>
  </div>
  <div v-else-if="portalTitularEnabled" class="saberes container mx-auto px-4 py-8" :style="{ '--marca': branding.primaryColor }" lang="es">
    <header>
      <p class="marca">{{ branding.name }} · Portal del titular</p>
      <h1>Reconocimiento de saberes previos</h1>
      <p>Si aprendiste algo en el trabajo, por tu cuenta o en otros espacios, puedes solicitar que se reconozca mediante una microcredencial. Elige una ficha del catálogo, explica qué sabes hacer y describe cómo puedes demostrarlo. La instancia que elijas revisará tu solicitud y aquí podrás consultar su respuesta.</p>
    </header>
    <p v-if="cargando" role="status">Cargando tus datos…</p>
    <div v-else-if="!sesion" class="tarjeta">
      <h2>Entra con tu cuenta</h2>
      <p>Usaremos el correo de tu cuenta para identificarte y dar seguimiento a tus solicitudes. Si ya entraste al portal, puede que solo necesites confirmar el acceso a esta sección.</p>
      <a class="boton" :href="loginUrl">Entrar con mi cuenta</a>
    </div>
    <template v-else>
      <section class="tarjeta" aria-labelledby="cuenta-saberes">
        <h2 id="cuenta-saberes">Tu cuenta</h2>
        <p>{{ sesion.nombre }} · {{ sesion.correo }}</p>
        <p v-if="sesion.correoVerificado">Tu correo está verificado.</p>
        <div v-else class="aviso">
          <p><strong>Verifica tu correo antes de presentar una solicitud.</strong> Entra a la configuración de tu cuenta institucional y sigue la indicación para verificarlo. Revisa tu bandeja de entrada y la carpeta de correo no deseado. Si no aparece esa opción o no recibes el mensaje, pide ayuda al soporte de tu cuenta.</p>
          <p>Después vuelve a entrar aquí para actualizar la verificación. Copia primero cualquier texto que quieras conservar.</p>
          <a :href="loginUrl">Ya lo verifiqué: volver a entrar</a>
        </div>
        <div class="acciones"><a :href="loginUrl">Renovar acceso</a><button type="button" @click="salir">Salir de esta sección</button></div>
      </section>
      <section id="formulario-saberes" class="tarjeta" aria-labelledby="nueva-saberes">
        <h2 id="nueva-saberes">{{ datos.solicitudAnterior ? 'Presenta una nueva solicitud de la misma ficha' : 'Presenta tu solicitud' }}</h2>
        <p>Consulta los criterios antes de enviar. Describe trabajos, experiencias o productos que permitan comprobar tus saberes; por ejemplo, un proyecto que realizaste y qué parte hiciste tú. Puedes incluir referencias o enlaces, pero aquí no se adjuntan archivos. No incluyas contraseñas ni documentos de identidad.</p>
        <p>Recibirás respuesta en diez días de lunes a viernes, sin descontar feriados. El conteo empieza después del día en que presentas tu solicitud. Vuelve a esta página para consultar el avance; no se envían avisos por correo.</p>
        <form @submit.prevent="enviar()">
          <fieldset :disabled="enviando || envioIncierto">
            <legend>Datos de la solicitud</legend>
            <label for="nombre-saberes">Nombre completo</label><input id="nombre-saberes" v-model="datos.nombreCompleto" required maxlength="255" autocomplete="name">
            <label>Matrícula (opcional)<input v-model="datos.matricula" maxlength="100"></label>
            <label>Instancia a la que diriges tu solicitud<select v-model="datos.instancia" required><option value="" disabled>Elige una instancia</option><option v-for="i in instancias" :key="i.clave" :value="i.clave">{{ i.nombre }}</option></select></label>
            <p v-if="!instancias.length">No hay instancias disponibles por el momento. Inténtalo más adelante.</p>
            <label>Microcredencial que quieres solicitar<select v-model="datos.claveLogro" required><option value="" disabled>Elige una ficha</option><option v-for="c in catalogo" :key="c.clave" :value="c.clave">{{ c.nombre }}</option></select></label>
            <p v-if="!catalogo.length">No hay fichas disponibles por el momento. Inténtalo más adelante.</p>
            <p v-if="cargandoFicha" role="status">Consultando los criterios…</p>
            <div v-if="ficha" class="respuesta">
              <h3>{{ ficha.nombre }}</h3>
              <p v-if="ficha.proposito">{{ ficha.proposito }}</p>
              <p v-if="ficha.resultadoAprendizaje"><strong>Qué debes demostrar:</strong> {{ ficha.resultadoAprendizaje }}</p>
              <p v-if="ficha.perfilIngreso"><strong>A quién está dirigida:</strong> {{ ficha.perfilIngreso }}</p>
              <p v-if="ficha.requisitosIngreso"><strong>Requisitos:</strong> {{ ficha.requisitosIngreso }}</p>
              <p v-if="ficha.contextoAplicacion"><strong>Dónde puedes aplicar estos saberes:</strong> {{ ficha.contextoAplicacion }}</p>
              <p v-for="(r, n) in ficha.resultadosAprendizaje || []" :key="n">{{ r.enunciado }}</p>
              <div v-for="(e, n) in ficha.evidencias || []" :key="n">
                <h4>{{ e.nombre }}</h4><p>{{ e.descripcion }}</p>
                <p v-if="e.rubrica?.criterios?.length">Estos criterios explican qué se valora. Abre cada uno para conocer los niveles de desempeño publicados en la ficha.</p>
                <details v-for="(c, j) in e.rubrica?.criterios || []" :key="j">
                  <summary>{{ c.nombre }}</summary>
                  <p>{{ c.descripcion }}</p>
                  <p v-if="c.ponderacion != null">Peso en la valoración: {{ c.ponderacion }} %.</p>
                  <p v-if="e.rubrica.regla?.criteriosEliminatorios?.includes(c.codigo)">Es necesario cumplir este criterio para acreditar.</p>
                  <p v-for="(nivel, k) in c.nivelesDesempeno || []" :key="k"><strong>{{ nivel.nombre }}:</strong> {{ nivel.descriptor }}<span v-if="nivel.puntos != null"> ({{ nivel.puntos }} puntos)</span></p>
                  <p v-if="e.rubrica.regla?.nivelMinimoPorCriterio != null">Nivel mínimo requerido: {{ c.nivelesDesempeno?.find((nivel: any) => nivel.nivel === e.rubrica.regla.nivelMinimoPorCriterio)?.nombre || e.rubrica.regla.nivelMinimoPorCriterio }}.</p>
                </details>
                <p v-if="e.rubrica?.regla?.puntajeMinimo != null">Puntaje mínimo publicado: {{ e.rubrica.regla.puntajeMinimo }}.</p>
                <p v-if="e.rubrica?.regla?.notaRegla">{{ e.rubrica.regla.notaRegla }}</p>
              </div>
            </div>
            <label>Qué sabes hacer y cómo lo aprendiste<textarea v-model="datos.descripcionSaberes" required maxlength="20000" rows="5" /></label>
            <label>Evidencias o referencias que puedes aportar (opcional)<textarea v-model="datos.evidencias" maxlength="20000" rows="4" /></label>
            <label>Fecha en que lograste estos saberes (opcional)<input v-model="datos.fechaLogro" type="date"></label>
            <p>Antes de enviar, comprueba que elegiste la instancia y la microcredencial correctas, y que tus ejemplos explican qué sabes hacer.</p>
            <button class="boton" :disabled="!sesion.correoVerificado || !ficha || !instancias.length || esperaSegundos > 0">{{ enviando ? 'Enviando…' : 'Presentar solicitud' }}</button>
          </fieldset>
        </form>
        <div v-if="envioIncierto" class="aviso" role="status">
          <p>No pudimos confirmar el envío. Conservamos el formulario tal como lo enviaste. Puedes consultar «Mis solicitudes» o reintentar el mismo envío: se recuperará la solicitud si ya llegó, sin crear otra.</p>
          <p v-if="esperaSegundos">Espera {{ esperaSegundos }} segundos antes de reintentar.</p>
          <button type="button" :disabled="enviando || esperaSegundos > 0" @click="enviar(true)">Reintentar el mismo envío</button>
          <button v-if="relecturaPendiente" type="button" @click="cambiarPagina(1)">Volver a consultar mis solicitudes</button>
          <button v-else type="button" @click="envioIncierto = false; pendiente = null; datos.descripcionSaberes = ''; datos.evidencias = ''; datos.solicitudAnterior = ''">La solicitud ya aparece: cerrar aviso</button>
        </div>
      </section>
      <section aria-labelledby="mis-solicitudes">
        <h2 id="mis-solicitudes">Mis solicitudes</h2>
        <p>Consulta el estado, el plazo y la respuesta. Si te piden completar información, aquí encontrarás las indicaciones y el formulario para hacerlo.</p>
        <button type="button" :disabled="enviando" @click="cambiarPagina(pagina)">Actualizar mis solicitudes</button>
        <p v-if="!solicitudes.length">No hay solicitudes en esta página.</p>
        <SolicitudTitular v-for="s in solicitudes" :key="s.referencia" :solicitud="s" :correo-verificado="sesion.correoVerificado" @actualizar="actualizar" @nueva="nueva" />
        <nav class="acciones" aria-label="Páginas de solicitudes"><button type="button" :disabled="pagina <= 1 || enviando" @click="cambiarPagina(pagina - 1)">Anterior</button><span>Página {{ pagina }}</span><button type="button" :disabled="solicitudes.length < 25 || pagina >= 999999 || enviando" @click="cambiarPagina(pagina + 1)">Siguiente</button></nav>
      </section>
    </template>
    <p v-if="error" class="aviso" role="alert">{{ error }} <button type="button" @click="cargar">Volver a cargar</button></p>
    <p v-if="mensaje" class="respuesta" role="status">{{ mensaje }}</p>
  </div>
</template>

<style>
.saberes { max-width: 58rem; color: #263238; line-height: 1.65; }
.saberes h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); line-height: 1.2; margin: .6rem 0 1rem; font-weight: 700; }
.saberes h2 { font-size: 1.4rem; font-weight: 650; margin: .5rem 0; }
.saberes h3 { font-size: 1.2rem; font-weight: 650; }
.saberes h4 { font-weight: 650; margin-top: .8rem; }
.saberes p { margin: .7rem 0; overflow-wrap: anywhere; }
.saberes .marca { border-left: 5px solid var(--marca); padding-left: .7rem; }
.saberes .tarjeta, .saberes .solicitud { background: white; padding: clamp(1rem, 3vw, 1.7rem); border: 1px solid #ccd3d6; border-radius: 1rem; margin: 1.5rem 0; }
.saberes label { display: block; font-weight: 550; margin: 1rem 0 .3rem; }
.saberes input, .saberes textarea, .saberes select { display: block; width: 100%; border: 1px solid #65747a; padding: .65rem; border-radius: .4rem; color: #263238; background: white; font: inherit; }
.saberes button, .saberes .boton { display: inline-block; border: 1px solid #52646d; padding: .55rem .9rem; border-radius: .4rem; text-decoration: none; background: white; cursor: pointer; }
.saberes .boton { background: #213f4f; border-bottom: 4px solid var(--marca); color: white; font-weight: 600; }
.saberes button:disabled, .saberes fieldset:disabled { opacity: .6; cursor: default; }
.saberes .acciones { display: flex; gap: .7rem; flex-wrap: wrap; align-items: center; margin: 1rem 0; }
.saberes .aviso { background: #fff4d6; border-left: 4px solid #926400; padding: 1rem; }
.saberes .respuesta { background: #f1f5f6; padding: 1rem; margin: 1rem 0; }
.saberes .texto { white-space: pre-wrap; }
.saberes a { color: #16475f; text-decoration: underline; }
.saberes summary { cursor: pointer; text-decoration: underline; }
.saberes :focus-visible { outline: 3px solid #135c85; outline-offset: 3px; }
.saberes ul { list-style: disc; padding-left: 1.5rem; }
.saberes fieldset { min-width: 0; }
</style>

<style scoped>
.mc-saberes__cabeza { padding: 1.75rem 0 5rem; }
.mc-saberes__cabeza .mc-contenedor { display: grid; gap: .4rem; }
.mc-saberes__cabeza .mc-etiqueta { opacity: .85; }
.mc-saberes__cabeza h1 { font-size: var(--mc-t-2xl); }
.mc-saberes__intro { opacity: .92; max-width: 42rem; font-size: var(--mc-t-l); line-height: 1.5; }
.mc-saberes__cuerpo { margin-top: -3.25rem; display: grid; gap: 1.25rem; min-width: 0; }
.mc-saberes__como { padding: 1.25rem; display: grid; gap: .8rem; }
.mc-saberes__como h2 { font-size: var(--mc-t-l); }
.mc-saberes__como ol { display: grid; gap: .65rem; }
.mc-saberes__como li { display: flex; gap: .65rem; align-items: flex-start; line-height: 1.45; }
.mc-saberes__como li > span, .mc-saberes__parte h3 > span {
  flex: none; display: grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%;
  background: var(--mc-hielo); color: var(--mc-enlace); font: 800 var(--mc-t-s) var(--mc-fuente-titulos);
}
.mc-saberes__esqueleto { height: 9rem; opacity: .6; }
.mc-saberes__bloque { padding: 1.5rem; display: grid; gap: .8rem; justify-items: start; }
.mc-saberes__bloque h2 { font-size: var(--mc-t-xl); }
.mc-saberes__cuenta { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; justify-content: space-between; padding: .25rem .25rem 0; }
.mc-saberes__cuenta p { display: flex; flex-wrap: wrap; gap: .35rem .6rem; align-items: center; overflow-wrap: anywhere; }
.mc-saberes__acciones { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.mc-saberes__nota { display: grid; gap: .55rem; justify-items: start; min-width: 0; }
.mc-saberes__mias { display: grid; gap: .9rem; }
.mc-saberes__titulo-lista { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.mc-saberes__titulo-lista h2 { font-size: var(--mc-t-xl); }
.mc-saberes__vacio { padding: 1.1rem 1.25rem; box-shadow: none; }
.mc-saberes__paginas { display: flex; gap: .75rem; align-items: center; justify-content: center; }
.mc-saberes__formulario { padding: 1.35rem; display: grid; gap: 1.1rem; }
.mc-saberes__formulario > h2 { font-size: var(--mc-t-xl); }
.mc-saberes__formulario fieldset { display: grid; gap: 1.5rem; min-width: 0; border: 0; padding: 0; margin: 0; }
.mc-saberes__formulario fieldset:disabled { opacity: .6; }
.mc-saberes__parte { display: grid; gap: .9rem; }
.mc-saberes__parte + .mc-saberes__parte { padding-top: 1.25rem; border-top: 1px solid var(--mc-linea); }
.mc-saberes__parte h3 { display: flex; align-items: center; gap: .6rem; font: 800 var(--mc-t-l) var(--mc-fuente-titulos); }
.mc-saberes__ficha { border: 1px solid var(--mc-linea); border-radius: var(--mc-r); background: var(--mc-hielo); padding: 1rem; display: grid; gap: .55rem; line-height: 1.55; overflow-wrap: anywhere; }
.mc-saberes__ficha h4 { font-size: var(--mc-t-l); }
.mc-saberes__resultados { display: grid; gap: .4rem; }
.mc-saberes__resultados li { display: flex; gap: .5rem; align-items: flex-start; }
.mc-saberes__resultados li > span { flex: none; margin-top: .2rem; color: var(--mc-ok); }
.mc-saberes__evidencia { border-top: 1px solid var(--mc-linea); padding-top: .6rem; display: grid; gap: .4rem; }
.mc-saberes__evidencia h5 { font-weight: 800; }
.mc-saberes__evidencia summary { cursor: pointer; color: var(--mc-enlace); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.mc-saberes__evidencia details[open] { display: grid; gap: .35rem; padding-bottom: .4rem; }
.mc-saberes__corto { max-width: 16rem; }
.mc-saberes__dos { display: grid; gap: .9rem; }
.mc-saberes__enviar { display: grid; gap: .55rem; justify-items: start; padding-top: 1.25rem; border-top: 1px solid var(--mc-linea); }
.mc-saberes .mc-aviso p { line-height: 1.5; overflow-wrap: anywhere; }
@media (min-width: 768px) {
  .mc-saberes__cabeza { padding: 2.5rem 0 5.5rem; }
  .mc-saberes__cabeza h1 { font-size: var(--mc-t-3xl); }
  .mc-saberes__como ol { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .mc-saberes__como li { flex-direction: column; }
  .mc-saberes__dos { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  .mc-saberes__formulario { padding: 1.75rem; }
}
</style>
