// @digitalbazaar/vc-bitstring-status-list ships no type declarations of its
// own; only the small surface this codebase actually calls is declared here.
declare module '@digitalbazaar/vc-bitstring-status-list' {
  export interface BitstringStatusList {
    setStatus(index: number, status: boolean): void
    getStatus(index: number): boolean
    encode(): Promise<string>
  }
  export function createList(options: { length: number }): Promise<BitstringStatusList>
  export function decodeList(options: { encodedList: string }): Promise<BitstringStatusList>
  export function createCredential(options: {
    id: string
    list: BitstringStatusList
    statusPurpose: string
    context?: string[]
  }): Promise<any>
  export const VC_BSL_VC_V1_CONTEXT: string[]
  export const VC_BSL_VC_V2_CONTEXT: string[]
}
