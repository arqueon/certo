<script setup lang="ts">
import { credentialMetadata, qualificationLabel } from '~/utils/credential-metadata'
const props = defineProps<{ credential: any; raw?: any }>()
const info = computed(() => credentialMetadata(props.credential, props.raw))
</script>

<template>
  <section class="credential-learning">
    <h2>Qué acredita</h2>
    <p v-if="info.achievement.description" class="description">{{ info.achievement.description }}</p>
    <div v-if="info.outcomes.length">
      <h3>Resultados de aprendizaje</h3>
      <ul><li v-for="(outcome, i) in info.outcomes" :key="i">{{ outcome.targetName }}</li></ul>
    </div>
    <dl>
      <template v-for="(level, i) in info.levels" :key="i">
        <dt>{{ level.targetFramework }}</dt><dd>{{ qualificationLabel(level) }}</dd>
      </template>
      <template v-if="info.credits !== undefined"><dt>Créditos</dt><dd>{{ info.credits }}</dd></template>
      <template v-if="info.achievement.fieldOfStudy"><dt>Campo de formación</dt><dd>{{ info.achievement.fieldOfStudy }}</dd></template>
      <template v-if="info.language"><dt>Idioma</dt><dd>{{ info.language }}</dd></template>
      <template v-if="info.achievement.humanCode"><dt>Clave y versión</dt><dd>{{ info.achievement.humanCode }}<span v-if="info.achievement.version"> · versión {{ info.achievement.version }}</span></dd></template>
    </dl>
    <ul v-if="info.achievement.tag?.length" class="tags"><li v-for="tag in info.achievement.tag" :key="tag">{{ tag }}</li></ul>
    <div v-for="(alignment, i) in info.otherAlignments" :key="i"><h3>{{ alignment.targetFramework || 'Marco de referencia' }}</h3><p>{{ alignment.targetName }}</p></div>
    <a v-if="info.catalog" :href="info.catalog" target="_blank" rel="noopener noreferrer">Consultar la ficha del logro</a>
  </section>
</template>

<style scoped>
h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
h3 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 .5rem; }
.description { white-space: pre-line; }
ul { padding-left: 1.25rem; list-style: disc; }
li { margin: .4rem 0; }
dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: .5rem 1rem; margin: 1rem 0; }
dt { font-weight: 600; }
a { display: inline-block; margin-top: 1rem; text-decoration: underline; }
.tags { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0; list-style: none; }
.tags li { border: 1px solid #cbd5e1; padding: .2rem .65rem; border-radius: 1rem; }
@media screen and (max-width: 640px) { dl { grid-template-columns: 1fr; gap: .25rem; } dt { margin-top: .5rem; } }
@media print { h2 { font-size: 13pt; margin: .6rem 0; } h3 { font-size: 11pt; margin: .5rem 0; } dl { margin: .5rem 0; gap: .2rem .6rem; } .tags li { margin: .1rem 0; } a { margin-top: .4rem; } }
</style>
