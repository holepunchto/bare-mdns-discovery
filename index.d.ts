declare module '@holepunchto/bare-mdns-discovery' {
  import ReadyResource from 'ready-resource'

  export interface RecordInfo {
    address: string
    port: number
    family: 'IPv4' | 'IPv6'
    size: number
  }

  export interface SRVData {
    priority: number
    weight: number
    port: number
    target: string
  }

  export interface TXTData {
    [key: string]: string | boolean
  }

  export interface Record {
    name: string
    type: number
    class: number
    flush: boolean
    ttl: number
    data: string | TXTData | SRVData | Buffer
  }

  export interface Service {
    uid: string
    name: string
    address: string
    addresses: {
      ipv4: string | null
      ipv6: string[]
    }
    port: number
    target: string
    txt: TXTData
  }

  export interface MDNSOptions {
    debug?: boolean
  }

  export interface DiscoveryOptions extends MDNSOptions {
    service?: string
  }

  export const TYPE: {
    readonly A: 1
    readonly PTR: 12
    readonly TXT: 16
    readonly AAAA: 28
    readonly SRV: 33
  }

  export const MDNS_ADDR: '224.0.0.251'
  export const MDNS_PORT: 5353

  class MDNS extends ReadyResource {
    constructor(opts?: MDNSOptions)

    debug: boolean
    socket: object | null

    query(name: string, type?: number): void

    on(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: 'ready', listener: () => void): this
    on(event: 'close', listener: () => void): this

    once(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    once(event: 'error', listener: (err: Error) => void): this
    once(event: 'ready', listener: () => void): this
    once(event: 'close', listener: () => void): this

    off(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    off(event: 'error', listener: (err: Error) => void): this
    off(event: 'ready', listener: () => void): this
    off(event: 'close', listener: () => void): this

    emit(event: 'records', records: Record[], rinfo: RecordInfo): boolean
    emit(event: 'error', err: Error): boolean
    emit(event: 'ready'): boolean
    emit(event: 'close'): boolean
  }

  class Discovery extends MDNS {
    constructor(opts?: DiscoveryOptions)

    service: string
    services: Map<string, Service>

    discover(timeout?: number): Promise<Service[]>

    on(event: 'service', listener: (service: Service) => void): this
    on(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: 'ready', listener: () => void): this
    on(event: 'close', listener: () => void): this

    once(event: 'service', listener: (service: Service) => void): this
    once(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    once(event: 'error', listener: (err: Error) => void): this
    once(event: 'ready', listener: () => void): this
    once(event: 'close', listener: () => void): this

    off(event: 'service', listener: (service: Service) => void): this
    off(event: 'records', listener: (records: Record[], rinfo: RecordInfo) => void): this
    off(event: 'error', listener: (err: Error) => void): this
    off(event: 'ready', listener: () => void): this
    off(event: 'close', listener: () => void): this

    emit(event: 'service', service: Service): boolean
    emit(event: 'records', records: Record[], rinfo: RecordInfo): boolean
    emit(event: 'error', err: Error): boolean
    emit(event: 'ready'): boolean
    emit(event: 'close'): boolean

    protected _parseService(records: Record[], rinfo: RecordInfo): Service | null
  }

  export { MDNS, Discovery }
  export default MDNS
}
