<script setup lang="ts">
import type { SolicitudSaberes } from '~/composables/useSaberesPrevios'
import SolicitudTitular from '~/components/saberes/SolicitudTitular.vue'
const branding = useBranding()
const route = useRoute()
const { request, enabled: portalTitularEnabled, loginUrl } = useSaberesPrevios()
useHead({ title: 'Reconocimiento de saberes previos', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
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
  } catch { if (numero === fichaPeticion) error.value = 'No se pudo consultar la ficha. Vuelve a seleccionarla antes de enviar.' }
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
    else error.value = 'No pudimos cargar esta sección. Vuelve a intentarlo en unos momentos.'
  } finally { cargando.value = false }
}
async function cambiarPagina(numero: number) {
  try { await listar(numero) } catch { error.value = 'No pudimos actualizar tus solicitudes. Vuelve a intentarlo.' }
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
  document.getElementById('nombre-saberes')?.focus({ preventScroll: true })
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
    mensaje.value = 'Tu solicitud quedó registrada. Consulta su estado y la fecha de respuesta en «Mis solicitudes».'
    solicitudes.value = [result.data, ...solicitudes.value.filter(s => s.referencia !== result.data.referencia)].slice(0, 25)
    pagina.value = 1
    datos.descripcionSaberes = ''; datos.evidencias = ''; datos.solicitudAnterior = ''; datos.fechaLogro = ''
    try { await listar(1) } catch { mensaje.value += ' La lista no pudo actualizarse completa; tu envío sí quedó confirmado.' }
  } catch (e: any) {
    const status = e.statusCode || e.status
    error.value = status === 401 ? 'Tu sesión terminó. Copia lo escrito antes de volver a entrar con tu cuenta.'
      : e.data?.error?.message || 'No pudimos confirmar si tu solicitud quedó registrada. Conservamos lo escrito.'
    if (status === 429) {
      esperarHasta.value = Date.now() + (Number(e.data?.error?.retryAfter) || 600) * 1000
    }
    if (!status || status >= 500 || status === 409 || status === 429) {
      envioIncierto.value = true; relecturaPendiente.value = true
      try { await listar(1) } catch { error.value += ' Aún no pudimos consultar la lista.' }
    } else { pendiente.value = null; envioIncierto.value = false }
  } finally { enviando.value = false }
}
async function salir() {
  try { await request('auth/salir', {}); sesion.value = null; solicitudes.value = []; ficha.value = null }
  catch { error.value = 'No pudimos cerrar la sesión. Vuelve a intentarlo.' }
}
onMounted(async () => {
  if (!portalTitularEnabled) return
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
  await cargar()
  if (route.query.acceso === 'fallido') error.value = 'No se pudo comprobar el acceso a tu cuenta. Vuelve a entrar; si continúa el problema, pide ayuda al soporte de tu cuenta.'
})
</script>

<template>
  <div v-if="portalTitularEnabled" class="saberes container mx-auto px-4 py-8" :style="{ '--marca': branding.primaryColor }" lang="es">
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
