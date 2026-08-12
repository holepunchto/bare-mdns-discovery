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

See the [full API reference](https://docs.pears.com/reference/bare/modules/bare-mdns-discovery).

## License

Apache-2.0
