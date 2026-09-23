<script setup lang="ts">
const branding = useBranding()
const { t } = useI18n()
</script>

<template>
  <footer class="w-full bg-gradient-to-b from-white to-[#FFE5AE]/20 pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <!-- Logo Column -->
        <div>
          <div class="flex items-center gap-3">
            <img :src="branding.logoUrl" :alt="`${branding.name} logo`" class="h-14 w-auto">
          </div>
          <p class="mt-4 text-text-secondary max-w-sm">
            {{ t('footer.description') }}
          </p>
        </div>

        <!-- Quick Links -->
        <div class="space-y-4">
          <h3 class="font-bold text-lg">
            {{ t('footer.linksTitle') }}
          </h3>
          <ul class="space-y-2">
            <li>
              <NuxtLink
                to="/"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.home') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/dashboard"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.dashboard') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/verify"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.verify') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/linkedin"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.linkedin') }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div class="space-y-4">
          <h3 class="font-bold text-lg">
            {{ t('footer.legal') }}
          </h3>
          <ul class="space-y-2">
            <li>
              <a
                href="/privacy-policy"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.privacyNotice') }}
              </a>
            </li>
            <li>
              <a
                href="/terms-and-conditions"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ t('footer.links.termsConditions') }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Copyright -->
      <div class="text-center text-text-secondary pt-8 border-t border-gray-200">
        <p>{{ branding.name }} © {{ new Date().getFullYear() }}.</p>
        <p class="text-xs mt-1">
          {{ t('footer.builtOn') }}
          <a
            href="https://github.com/arqueon/certo"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-text-primary"
          >Certo</a>
          {{ t('footer.license') }}
          <a
            href="https://github.com/arqueon/certo"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-text-primary"
          >{{ t('footer.sourceCode') }}</a>
        </p>
      </div>
    </div>
  </footer>
</template>
