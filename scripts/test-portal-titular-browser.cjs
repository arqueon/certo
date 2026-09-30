/* Isolated browser harness: real Vue components, synthetic API, no services or secrets. */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const { build } = require('esbuild')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'certo-portal-ui-'))
const appRoot = path.join(root, 'src/frontend/app')
const entry = `
import {createApp,h} from 'vue';
import Page from ${JSON.stringify(path.join(appRoot, 'pages/saberes-previos.vue'))};
import Header from ${JSON.stringify(path.join(appRoot, 'components/Header.vue'))};
import Dashboard from ${JSON.stringify(path.join(appRoot, 'pages/dashboard.vue'))};
const params=new URL(location.href).searchParams;
window.useRuntimeConfig=()=>({public:{apiUrl:'https://api.example.test',portalTitularEnabled:params.get('enabled')||'true'}});
window.useRouter=()=>({push:path=>{window.redirected=path}});
window.useI18n=()=>({t:key=>key,locale:'es'});
window.useWebsiteUrl=()=> 'https://portal.example.test';
window.useSeoMeta=()=>{}; window.definePageMeta=()=>{}; window.onClickOutside=()=>{};
window.HEADER_NAV_LINKS=[];
window.logoutCount=0;
window.useAuthStore=()=>({isAuthenticated:true,isIssuer:false,user:{username:'Persona'},logout(){window.logoutCount++}});
window.useBranding=()=>({name:'UDGPlus',primaryColor:'#b58b32'});
window.useHead=()=>{}; window.useRoute=()=>({query:{}});
window.calls=[]; window.mode='ok';
const base={referencia:'synthetic-private-id',estado:'no_procede',createdAt:'2026-09-25T18:00:00Z',fechaLimite:'2026-10-09',
  subsanable:true,reaperturaUsada:false,correoVerificado:true,instancia:'instance-one',instanciaDestinataria:'Centro de formación',
  descripcionSaberes:'Organicé un proyecto comunitario.',evidencias:'Informe del proyecto',
  logro:{clave:'technical-key',nombre:'Coordinación de proyectos'},justificacion:'Falta explicar tu participación.',
  criteriosEquivalencia:'Organización y seguimiento del trabajo',indicacionesSubsanacion:'Describe las decisiones que tomaste.'};
let rows=[base,{...base,referencia:'recognized-id',estado:'reconocida',estadoCredencial:'emitida',subsanable:false,reaperturaUsada:true}];
window.$fetch=async (url,options={})=>{
  window.calls.push({url,options});
  if(url.endsWith('/auth/salir')) {
    const failure=params.get('failure');
    if(failure==='network') throw new TypeError('Synthetic network failure');
    if(failure==='timeout') {await new Promise(resolve=>setTimeout(resolve,options.timeout));throw new Error('Timeout');}
    if(failure==='unknown') throw null;
    if(failure) throw {statusCode:Number(failure)};
    return {data:{ok:true}};
  }
  if(url.endsWith('/sesion')) return {data:{nombre:'María Ejemplo',correo:'persona@example.test',correoVerificado:window.testVerified!==false}};
  if(url.endsWith('/catalogo-publico')) return {data:[{clave:'technical-key',nombre:'Coordinación de proyectos'}]};
  if(url.includes('/catalogo-publico/')) return {data:{clave:'technical-key',nombre:'Coordinación de proyectos',proposito:'Organizar el trabajo de un equipo.',
    resultadoAprendizaje:'Planificar y dar seguimiento a un proyecto.',evidencias:[{nombre:'Proyecto realizado',descripcion:'Describe tu participación.',rubrica:{criterios:[{nombre:'Organización',descripcion:'Explicas tareas y responsabilidades.'}]}}]}};
  if(url.endsWith('/instancias')) return {data:[{clave:'instance-one',nombre:'Centro de formación',activa:true}]};
  if(url.includes('?pagina=')) return {data:rows,meta:{pagina:1}};
  if(options.method==='POST') {
    if(window.mode==='rate') throw {statusCode:429,data:{error:{retryAfter:2}}};
    if(window.mode==='uncertain') throw {statusCode:502};
    if(window.mode==='conflict') {rows[0]={...rows[0],estado:'en_revision'};throw {statusCode:409};}
    if(url.endsWith('/solicitudes-saberes')) {
      const s={...base,referencia:'new-id',estado:'presentada',...options.body.data};rows=[s,...rows];return {data:s};
    }
    if(url.endsWith('/subsanar')) {rows[0]={...rows[0],estado:'subsanada',...options.body.data};return {data:rows[0]};}
    return {data:{...rows[0],estado:'reapertura_solicitada',reaperturaUsada:true}};
  }
  if(url.includes('/solicitudes-saberes/')) return {data:rows[0]};
  throw new Error('Unexpected mocked route '+url);
};
const app=createApp(params.get('view')==='header'?Header:params.get('view')==='dashboard'?Dashboard:Page);
app.component('NuxtImg',{setup(){return ()=>h('img')}});
app.component('LanguageSwitcher',{setup(){return ()=>null}});
app.component('NuxtLink',{props:['to'],setup(props,{slots}){return ()=>h('a',{href:props.to},slots.default?.())}});
app.mount('#app');`
;(async () => {
  await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'portal-harness.js' }, bundle: true,
    tsconfigRaw: { compilerOptions: { target: 'ES2022' } },
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter), outfile: path.join(tmp, 'bundle.js'),
    define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    plugins: [{ name: 'real-vue-components', setup(b) {
      b.onResolve({ filter: /^@vueuse\/core$/ }, () => ({ path: 'vueuse-stub', namespace: 'test-stubs' }))
      b.onResolve({ filter: /^~\/(stores\/auth|api\/api-client)$/ }, args => ({ path: args.path, namespace: 'test-stubs' }))
      b.onLoad({ filter: /.*/, namespace: 'test-stubs' }, args => ({ contents: args.path==='vueuse-stub'
        ? 'export const useWindowScroll=()=>({y:{value:0}})'
        : args.path.endsWith('stores/auth') ? 'export const useAuthStore=()=>window.useAuthStore()'
        : 'export const apiClient={getReceivedCertificates:async()=>({data:[]}),getIssuedCertificates:async()=>({data:[]})}' }))
      b.onResolve({ filter: /^~\// }, args => ({ path: path.join(appRoot, args.path.slice(2)) + (path.extname(args.path) ? '' : '.ts') }))
      b.onLoad({ filter: /\.vue$/ }, args => {
        const { descriptor, errors } = parse(fs.readFileSync(args.path, 'utf8'), { filename: args.path }); assert.deepEqual(errors, [])
        const compiled = compileScript(descriptor, { id: args.path, inlineTemplate: true })
        const auto = `import {ref,reactive,computed,watch,onMounted,onUnmounted,nextTick,shallowRef,useTemplateRef} from 'vue';\nimport {useSaberesPrevios} from ${JSON.stringify(path.join(appRoot, 'composables/useSaberesPrevios.ts'))};\n`
        return { contents: auto + compiled.content, loader: 'ts', resolveDir: path.dirname(args.path) }
      })
    } }] })
  const source = fs.readFileSync(path.join(appRoot, 'pages/saberes-previos.vue'), 'utf8')
  const style = parse(source).descriptor.styles.map(s => s.content).join('\n')
  fs.writeFileSync(path.join(tmp, 'index.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#faf9f5;font:16px system-ui}.container{margin:auto;padding:24px;box-sizing:border-box}*{box-sizing:border-box}${style}</style><div id="app"></div><script src="bundle.js"></script></html>`)
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.route(/^https?:/, route => route.abort())
    const failures = []; page.on('pageerror', e => failures.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text()) })
    const harnessUrl = pathToFileURL(path.join(tmp, 'index.html')).href
    await page.goto(harnessUrl)
    await page.getByText('Tu correo está verificado.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Consultar mis credenciales', exact: true }).getAttribute('href'), '/dashboard')
    await page.getByLabel('Instancia a la que diriges tu solicitud').selectOption('instance-one')
    await page.getByLabel('Microcredencial que quieres solicitar').selectOption('technical-key')
    await page.getByText('Organización', { exact: true }).click()
    await page.getByText('Explicas tareas y responsabilidades.', { exact: false }).waitFor()
    await page.getByLabel('Qué sabes hacer y cómo lo aprendiste', { exact: true }).first().fill('Planifiqué las tareas de un proyecto y coordiné a cinco personas.')
    await page.getByLabel('Evidencias o referencias que puedes aportar (opcional)').fill('Informe del proyecto y cronograma')
    assert.ok(!(await page.locator('body').innerText()).includes('synthetic-private-id'))
    assert.ok(!(await page.locator('body').innerText()).includes('technical-key'))
    await page.screenshot({ path: path.join(tmp, 'desktop.png'), fullPage: true })
    await page.getByRole('button', { name: 'Presentar solicitud', exact: true }).click()
    await page.getByText('Tu solicitud quedó registrada.', { exact: false }).waitFor()
    const posted = await page.evaluate(() => window.calls.find(c => c.url.endsWith('/solicitudes-saberes') && c.options.method === 'POST'))
    assert.equal(posted.options.baseURL, 'https://api.example.test')
    assert.equal(posted.options.credentials, 'include')
    assert.deepEqual(Object.keys(posted.options.body.data).sort(), ['claveLogro','descripcionSaberes','evidencias','instancia','nombreCompleto'])
    console.log('OK browser: catalog criteria, form submit, no browser identity, confirmation')
    await page.reload(); await page.getByText('Tu correo está verificado.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Presentar una solicitud nueva', exact: true }).click()
    await page.getByRole('heading', { name: 'Presenta una nueva solicitud de la misma ficha' }).waitFor()
    await page.getByRole('button', { name: 'Presentar solicitud', exact: true }).click()
    await page.getByText('Tu solicitud quedó registrada.', { exact: false }).waitFor()
    const followup = await page.evaluate(() => window.calls.find(c => c.url.endsWith('/solicitudes-saberes') && c.options.method === 'POST'))
    assert.equal(followup.options.body.data.solicitudAnterior, 'synthetic-private-id')
    assert.notEqual(followup.options.headers['Idempotency-Key'], posted.options.headers['Idempotency-Key'])
    console.log('OK browser: new request preserves previous reference after asynchronous catalog read')
    await page.reload(); await page.getByText('Tu correo está verificado.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Completar solicitud', exact: true }).click()
    await page.locator('article').first().getByLabel('Qué sabes hacer y cómo lo aprendiste').fill('Texto que debe conservarse ante un conflicto')
    await page.evaluate(() => { window.mode = 'conflict' })
    await page.locator('article').first().getByRole('button', { name: 'Enviar', exact: true }).click()
    await page.getByText('La solicitud cambió.', { exact: false }).waitFor()
    assert.equal(await page.locator('article').first().getByLabel('Qué sabes hacer y cómo lo aprendiste').inputValue(), 'Texto que debe conservarse ante un conflicto')
    assert.equal(await page.locator('article').first().getByRole('button', { name: 'Enviar', exact: true }).isDisabled(), true)
    console.log('OK browser: 409 rereads detail, preserves text and disables stale action')
    await page.reload(); await page.getByText('Tu correo está verificado.', { exact: true }).waitFor()
    await page.getByLabel('Instancia a la que diriges tu solicitud').selectOption('instance-one')
    await page.getByLabel('Microcredencial que quieres solicitar').selectOption('technical-key')
    await page.getByLabel('Qué sabes hacer y cómo lo aprendiste', { exact: true }).first().fill('Formulario de envío incierto')
    await page.evaluate(() => { window.mode = 'uncertain' })
    await page.getByRole('button', { name: 'Presentar solicitud', exact: true }).click()
    await page.getByRole('button', { name: 'Reintentar el mismo envío' }).waitFor()
    assert.equal(await page.getByLabel('Qué sabes hacer y cómo lo aprendiste', { exact: true }).first().inputValue(), 'Formulario de envío incierto')
    const calls = await page.evaluate(() => window.calls)
    const idx = calls.findIndex(c => c.options.method === 'POST')
    assert.ok(calls.slice(idx + 1).some(c => c.url.includes('solicitudes-saberes?pagina=1')))
    const originalPost = calls.find(c => c.options.method === 'POST')
    await page.evaluate(() => { window.mode = 'ok' })
    await page.getByRole('button', { name: 'Reintentar el mismo envío' }).click()
    await page.getByText('Tu solicitud quedó registrada.', { exact: false }).waitFor()
    const posts = await page.evaluate(() => window.calls.filter(c => c.options.method === 'POST'))
    assert.deepEqual(posts[1].options.body, originalPost.options.body)
    assert.equal(posts[1].options.headers['Idempotency-Key'], originalPost.options.headers['Idempotency-Key'])
    console.log('OK browser: uncertain creation rereads list and retries identical body/key')
    await page.getByLabel('Qué sabes hacer y cómo lo aprendiste', { exact: true }).first().fill('Otro envío para probar el tiempo de espera')
    await page.evaluate(() => { window.mode = 'rate' })
    await page.getByRole('button', { name: 'Presentar solicitud', exact: true }).click()
    await page.getByText('Espera 2 segundos antes de reintentar.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Reintentar el mismo envío' }).isDisabled(), true)
    await page.waitForTimeout(2100)
    assert.equal(await page.getByRole('button', { name: 'Reintentar el mismo envío' }).isEnabled(), true)
    console.log('OK browser: Retry-After disables retries until waiting period ends')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: path.join(tmp, 'mobile.png'), fullPage: true })
    await page.screenshot({ path: path.join(tmp, 'mobile-viewport.png') })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.addInitScript(() => { window.testVerified = false })
    await page.reload(); await page.getByText('Verifica tu correo antes de presentar una solicitud.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Presentar solicitud', exact: true }).isDisabled(), true)
    for (const enabled of ['false', '0', 'true']) {
      await page.goto(harnessUrl + '?view=dashboard&enabled=' + enabled)
      assert.equal(await page.locator('a[href="/saberes-previos"]').count(), enabled === 'true' ? 1 : 0)
      await page.goto(harnessUrl + '?enabled=' + enabled)
      if (enabled === 'true') {
        await page.getByRole('link', { name: 'Renovar acceso' }).waitFor()
        assert.equal(await page.getByRole('link', { name: 'Renovar acceso' }).getAttribute('href'), 'https://api.example.test/api/portal-titular/auth/iniciar')
      } else {
        assert.equal(await page.locator('.saberes').count(), 0)
        assert.deepEqual(await page.evaluate(() => window.calls), [])
      }
    }
    console.log('OK browser: disabled dashboard link and section; enabled login targets API origin')
    for (const [enabled, failure] of [['false', ''], ['true', ''], ...['401', '403', '404', '500', '502', '503', 'network', 'timeout', 'unknown'].map(value => ['true', value])]) {
      await page.goto(harnessUrl + '?view=header&enabled=' + enabled + '&failure=' + failure)
      await page.getByRole('button', { name: 'Persona' }).click()
      await page.getByRole('button', { name: 'nav.logout', exact: true }).first().click()
      await page.waitForFunction(() => window.logoutCount === 1 && window.redirected === '/')
      const calls = await page.evaluate(() => window.calls)
      assert.equal(calls.length, enabled === 'true' ? 1 : 0)
      if (enabled === 'true') {
        assert.equal(calls[0].url, '/api/portal-titular/auth/salir')
        assert.equal(calls[0].options.baseURL, 'https://api.example.test')
        assert.equal(calls[0].options.credentials, 'include')
        assert.equal(calls[0].options.method, 'POST')
        assert.equal(calls[0].options.retry, 0)
        assert.equal(calls[0].options.timeout, 3000)
        assert.deepEqual(calls[0].options.body, { data: {} })
      }
    }
    console.log('OK browser: global logout continues for HTTP errors, network failure, timeout and unknown errors; disabled portal makes no request')
    assert.deepEqual(failures, [])
    console.log('OK browser: unverified email guidance, mobile without horizontal overflow; no JS errors')
    console.log(`Artifacts: ${tmp}`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
