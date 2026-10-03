import { apiClient } from '~/api/api-client'
import type { VerificationResult } from '~/types/openbadges'

export function useHolderCredential(id: string) {
  const auth = useAuthStore()
  const branding = useBranding()
  const holderData = ref<VerificationResult | null>(null)
  const holderLoading = ref(false)
  let requestId = 0
  async function loadHolder() {
    const current = ++requestId
    if (!branding.active || !auth.isAuthenticated) { holderData.value = null; holderLoading.value = false; return }
    holderLoading.value = true
    try {
      const response = await apiClient.get<VerificationResult>(`/api/credentials/${encodeURIComponent(id)}/holder`)
      if (current === requestId) holderData.value = response
    } catch { if (current === requestId) holderData.value = null }
    finally { if (current === requestId) holderLoading.value = false }
  }
  onMounted(loadHolder)
  watch(() => [auth.isAuthenticated, auth.user?.id], loadHolder)
  return { holderData, holderLoading, loadHolder }
}
