<script setup lang="ts">
import { useMounted } from '@vueuse/core'

// Portada pública (dirección B): un encabezado con imagen —la insignia y una
// credencial verificada, dibujadas con la identidad UDGPlus— y las tres
// puertas de entrada: tengo una credencial, me mostraron una, qué se acredita.
const { t } = useI18n()
const branding = useBranding()
const authStore = useAuthStore()
const mounted = useMounted()
const signedIn = computed(() => mounted.value && authStore.isAuthenticated)
</script>

<template>
  <div class="mc-portada">
    <section class="mc-portada__cabeza mc-degradado mc-puntos">
      <div class="mc-contenedor mc-portada__rejilla">
        <div class="mc-portada__texto">
          <p class="mc-etiqueta">{{ t('portal.b.landing.eyebrow') }}</p>
          <h1 class="mc-titulo">{{ t('portal.home.title', { brand: branding.name }) }}</h1>
          <p class="mc-portada__intro">{{ t('portal.home.intro') }}</p>
          <div class="mc-portada__botones">
            <NuxtLink :to="signedIn ? '/dashboard' : '/login?redirect=/dashboard'" class="mc-boton mc-boton--claro">
              {{ t(signedIn ? 'nav.myCredentials' : 'portal.b.landing.signIn') }}
            </NuxtLink>
            <NuxtLink to="/verify" class="mc-boton mc-boton--vidrio">{{ t('portal.b.landing.verify') }}</NuxtLink>
          </div>
        </div>

        <figure class="mc-ilustracion" :aria-label="t('portal.b.landing.figure')">
          <div class="mc-ilustracion__medalla" aria-hidden="true">
            <div><img :src="branding.logoUrl" alt=""><small>{{ t('portal.b.landing.badge') }}</small></div>
          </div>
          <div class="mc-ilustracion__tarjeta" aria-hidden="true">
            <span class="mc-ilustracion__sello"><span class="i-heroicons-check-badge" /></span>
            <span>
              <b>{{ t('portal.b.landing.sampleName') }}</b>
              <small>{{ t('portal.b.landing.sampleStatus') }}</small>
            </span>
          </div>
          <div class="mc-ilustracion__chip" aria-hidden="true"><span class="i-heroicons-qr-code" /> {{ t('portal.b.landing.sampleQr') }}</div>
        </figure>
      </div>
    </section>

    <div class="mc-contenedor mc-portada__puertas">
      <article class="mc-puerta mc-tarjeta">
        <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-academic-cap" /></span>
        <h2 class="mc-titulo">{{ t('portal.home.holder') }}</h2>
        <p>{{ t('portal.home.holderText') }}</p>
        <NuxtLink :to="signedIn ? '/dashboard' : '/login?redirect=/dashboard'" class="mc-boton">{{ t(signedIn ? 'nav.myCredentials' : 'nav.login') }}</NuxtLink>
      </article>
      <article class="mc-puerta mc-tarjeta">
        <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-shield-check" /></span>
        <h2 class="mc-titulo">{{ t('portal.home.verifier') }}</h2>
        <p>{{ t('portal.home.verifierText') }}</p>
        <NuxtLink to="/verify" class="mc-boton mc-boton--secundario">{{ t('nav.verify') }}</NuxtLink>
      </article>
      <article v-if="branding.catalogUrl" class="mc-puerta mc-tarjeta">
        <span class="mc-mosaico" aria-hidden="true"><span class="i-heroicons-book-open" /></span>
        <h2 class="mc-titulo">{{ t('portal.home.catalog', { brand: branding.name }) }}</h2>
        <p>{{ t('portal.home.catalogText') }}</p>
        <a :href="branding.catalogUrl" class="mc-boton mc-boton--secundario">{{ t('nav.catalog') }}</a>
      </article>
    </div>
    <p class="mc-contenedor mc-portada__ejemplo mc-suave">{{ t('portal.home.example') }}</p>
  </div>
</template>

<style scoped>
.mc-portada__cabeza { padding: 2.5rem 0 6rem; overflow: hidden; }
.mc-portada__rejilla { display: grid; gap: 2.5rem; align-items: center; }
.mc-portada__texto { display: grid; gap: 1rem; }
.mc-portada__texto .mc-etiqueta { opacity: .8; }
.mc-portada__texto h1 { font-size: clamp(2.1rem, 6vw, 3.4rem); }
.mc-portada__intro { font-size: var(--mc-t-l); opacity: .92; max-width: 34rem; line-height: 1.55; }
.mc-portada__botones { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .5rem; }

.mc-ilustracion { position: relative; justify-self: center; width: min(72%, 260px); aspect-ratio: 1; margin: 0; }
.mc-ilustracion__medalla {
  position: absolute; inset: 8% 10% 14% 10%; border-radius: 50%; padding: 12px;
  background: conic-gradient(from 210deg, #63abd0, #2a6f97, #1a203b, #35638e, #63abd0);
  box-shadow: 0 0 0 10px rgba(99, 171, 208, .16), 0 30px 60px -20px rgba(8, 12, 28, .7);
}
.mc-ilustracion__medalla > div {
  width: 100%; height: 100%; border-radius: 50%; background: #fff; color: #1a203b;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem;
}
.mc-ilustracion__medalla img { width: 56%; height: auto; }
.mc-ilustracion__medalla small { font-size: .7rem; font-weight: 800; letter-spacing: .16em; color: #2a6f97; }
.mc-ilustracion__tarjeta {
  position: absolute; left: -2%; bottom: 4%; display: flex; align-items: center; gap: .65rem;
  padding: .7rem .9rem; border-radius: 16px; background: #fff; color: #16203a; max-width: 78%;
  box-shadow: 0 18px 36px -14px rgba(8, 12, 28, .6); transform: rotate(-3deg);
}
.mc-ilustracion__tarjeta b { display: block; font-size: .85rem; line-height: 1.2; }
.mc-ilustracion__tarjeta small { display: block; font-size: .72rem; color: #17795a; font-weight: 700; }
.mc-ilustracion__sello { flex: none; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 10px; background: #ddf3ea; color: #17795a; font-size: 1.3rem; }
.mc-ilustracion__chip {
  position: absolute; right: 0; top: 6%; display: inline-flex; align-items: center; gap: .35rem;
  padding: .4rem .7rem; border-radius: 999px; background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .35);
  color: #fff; font-size: .75rem; font-weight: 700; backdrop-filter: blur(4px); transform: rotate(4deg);
}

.mc-portada__puertas { margin-top: -3.5rem; display: grid; gap: 1rem; position: relative; }
.mc-puerta { padding: 1.4rem; display: grid; gap: .7rem; align-content: start; justify-items: start; }
.mc-puerta h2 { font-size: var(--mc-t-l); }
.mc-puerta p { color: var(--mc-suave); line-height: 1.55; flex: 1; }
.mc-portada__ejemplo { margin-top: 1.5rem; margin-bottom: 1rem; font-size: var(--mc-t-s); max-width: 48rem; }

@media (min-width: 768px) {
  .mc-portada__cabeza { padding: 3.5rem 0 7rem; }
  .mc-portada__rejilla { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
  .mc-ilustracion { width: min(100%, 380px); }
  .mc-portada__puertas { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: no-preference) {
  .mc-ilustracion__tarjeta { animation: mc-flota 6s ease-in-out infinite; }
  @keyframes mc-flota { 50% { transform: rotate(-3deg) translateY(-6px); } }
}
</style>
