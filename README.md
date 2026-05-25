# bare-mdns-discovery

> ⚠️ **Experimental** Claude generated prototype

Minimal mDNS/DNS-SD service discovery.

## Installation

```
npm install bare-mdns-discovery
```

## Usage

### Low-level mDNS queries

```javascript
const { MDNS } = require('bare-mdns-discovery')

const mdns = new MDNS({ debug: true })
await mdns.ready()

mdns.on('records', (records, rinfo) => {
  console.log('from:', rinfo.address)
  for (const r of records) {
    console.log(r.type, r.name, r.data)
  }
})

mdns.query('_services._dns-sd._udp.local')
mdns.query('_http._tcp.local')
mdns.query('_googlecast._tcp.local')

setTimeout(() => mdns.close(), 10000)
```

### Service discovery

```javascript
const { Discovery } = require('bare-mdns-discovery')

const discovery = new Discovery({ service: 'googlecast' })
await discovery.ready()

discovery.on('service', (service) => {
  console.log('Found:', service.name, service.address, service.port)
})

const services = await discovery.discover(10) // 10 second timeout
console.log('All services:', services)

await discovery.close()
```

### Extending for specific services

```javascript
const { Discovery } = require('bare-mdns-discovery')

class MyServiceDiscovery extends Discovery {
  constructor(opts = {}) {
    super({ ...opts, service: 'myservice' })
  }

  _parseService(records, rinfo) {
    const service = super._parseService(records, rinfo)
    if (!service) return null

    // Add custom filtering or fields
    return {
      ...service,
      customField: service.txt.someKey
    }
  }
}
```

## API

### `new MDNS(opts?)`

Create a low-level mDNS instance.

Options:

- `debug` (boolean): Enable debug logging. Default: `false`
- `iface` (string): IPv4 address of the network interface to join the multicast group on. Required on Android — without this, `addMembership` falls back to the OS default interface which may not be the WiFi interface, causing responses to be silently dropped. Pass the WiFi IP (e.g. from `bare-wifi-android`'s `getWifiIP()`).

#### `mdns.ready()`

Wait for the socket to be bound. Returns a Promise.

#### `mdns.query(name, type?)`

Send an mDNS query.

- `name` (string): Service name, e.g. `'_http._tcp.local'`
- `type` (number): Record type. Default: `TYPE.PTR` (12)

#### `mdns.close()`

Close the socket. Returns a Promise.

#### Event: `'records'`

Emitted when records are received.

```javascript
mdns.on('records', (records, rinfo) => {
  // records: Array of parsed DNS records
  // rinfo: { address, port, family, size }
})
```

### `new Discovery(opts?)`

High-level service discovery. Extends `MDNS`.

Options:

- `service` (string): Service type without prefix/suffix, e.g. `'http'`, `'googlecast'`
- `debug` (boolean): Enable debug logging. Default: `false`

#### `discovery.discover(timeout?)`

Discover services on the network. Returns a Promise resolving to an array of services.

- `timeout` (number): Discovery timeout in seconds. Default: `10`

#### `discovery.services`

Map of discovered services keyed by uid.

#### Event: `'service'`

Emitted when a service is discovered.

```javascript
discovery.on('service', (service) => {
  // service: { uid, name, address, addresses, port, target, txt }
})
```

### Record Types

```javascript
const { TYPE } = require('bare-mdns-discovery')

TYPE.A // 1 - IPv4 address
TYPE.PTR // 12 - Pointer
TYPE.TXT // 16 - Text
TYPE.AAAA // 28 - IPv6 address
TYPE.SRV // 33 - Service
```

### Constants

```javascript
const { MDNS_ADDR, MDNS_PORT } = require('bare-mdns-discovery')

MDNS_ADDR // '224.0.0.251'
MDNS_PORT // 5353
```

## License

Apache-2.0
