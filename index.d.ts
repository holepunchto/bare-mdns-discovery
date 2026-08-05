declare module 'bare-mdns-discovery' {
  import ReadyResource from 'ready-resource'

  /** The remote address information for a received mDNS packet: `address`, `port`, `family`, and the packet `size` in bytes. */
  export interface RecordInfo {
    address: string
    port: number
    family: 'IPv4' | 'IPv6'
    size: number
  }

  /** The parsed data of an SRV record: `priority`, `weight`, `port`, and `target` hostname. */
  export interface SRVData {
    priority: number
    weight: number
    port: number
    target: string
  }

  /** The parsed key/value pairs of a TXT record. A key with no `=` in its entry is stored with the value `true`. */
  export interface TXTData {
    [key: string]: string | boolean
  }

  /** A single parsed DNS resource record from an mDNS response: `name`, `type`, `class`, the `flush` cache-flush bit, `ttl`, and the type-specific `data`. */
  export interface Record {
    name: string
    type: number
    class: number
    flush: boolean
    ttl: number
    data: string | TXTData | SRVData | Buffer
  }

  /** A discovered service: its unique id, `name`, resolved `address`, all known `addresses` (IPv4 and IPv6), `port`, SRV `target` hostname, and `txt` record data. */
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

  /** Options for `MDNS`. `debug` logs internal activity to the console. `iface` is the IPv4 address of the network interface to bind multicast membership on; required on Android, where it must be the WiFi interface IP so the kernel delivers mDNS responses on the correct interface. */
  export interface MDNSOptions {
    /** Whether internal activity is logged to the console. */
    debug?: boolean
    /** IPv4 address of the network interface to bind multicast membership on.
     *  Required on Android: pass the WiFi interface IP so the kernel delivers
     *  mDNS responses on the correct interface. */
    iface?: string
  }

  /** Options for `Discovery`, extending `MDNSOptions` with `service`, the mDNS service name to query for (for example `'googlecast'`). */
  export interface DiscoveryOptions extends MDNSOptions {
    /** The mDNS service name being discovered. */
    service?: string
  }

  /** DNS record type numbers used in mDNS queries and records, per RFC 6762: `A`, `PTR`, `TXT`, `AAAA`, and `SRV`. */
  export const TYPE: {
    readonly A: 1
    readonly PTR: 12
    readonly TXT: 16
    readonly AAAA: 28
    readonly SRV: 33
  }

  /** The IPv4 multicast address used for mDNS, `224.0.0.251`, per RFC 6762. */
  export const MDNS_ADDR: '224.0.0.251'
  /** The UDP port used for mDNS, `5353`, per RFC 6762. */
  export const MDNS_PORT: 5353

  /** Send and receive raw mDNS queries and records over UDP multicast. Extends `ReadyResource`; open it with `ready()` and release its socket with `close()`. */
  export class MDNS extends ReadyResource {
    constructor(opts?: MDNSOptions)

    debug: boolean
    /** The underlying UDP socket, or `null` before the resource has opened. */
    socket: object | null

    /**
     * Sends an mDNS query for `name`.
     * @param name - The DNS name to query for, for example `'_http._tcp.local'`.
     * @param type - The DNS record type to request (default `TYPE.PTR`).
     */
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

  /** Discovers instances of a specific mDNS `service` (such as `'googlecast'` or `'http'`) by periodically querying for it and parsing SRV, TXT, and address records into `Service` objects. Extends `MDNS`; subclass and override `_parseService` to customize how records are turned into a `Service` for a given service type. */
  export class Discovery extends MDNS {
    constructor(opts?: DiscoveryOptions)

    service: string
    /** A map of discovered services, keyed by service `uid`, accumulated since the last `discover()` call. */
    services: Map<string, Service>

    /**
     * Queries for the configured service every 2 seconds until `timeout` milliseconds elapse (default `10000`), or resolves early when `opts.first` is set and a service has been found.
     * @param opts - Options: `timeout` is how long, in milliseconds, to keep querying before resolving (default `10000`); set `first` to resolve as soon as the first service is found instead of waiting out the timeout.
     * @returns The discovered `Service` objects — a single-element array when `opts.first` resolved early.
     */
    discover(opts?: { first?: boolean; timeout?: number }): Promise<Service[]>

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

  export default MDNS
}
