const { createSocket } = require('dgram')
const ReadyResource = require('ready-resource')

// mDNS constants (RFC 6762)
const MDNS_ADDR = '224.0.0.251'
const MDNS_PORT = 5353

// DNS record types
const TYPE = {
  A: 1,
  PTR: 12,
  TXT: 16,
  AAAA: 28,
  SRV: 33
}

function buildQuery(name, type = TYPE.PTR) {
  const labels = name.split('.')
  const question = []

  for (const label of labels) {
    question.push(label.length)
    for (let i = 0; i < label.length; i++) {
      question.push(label.charCodeAt(i))
    }
  }
  question.push(0)
  question.push((type >> 8) & 0xff, type & 0xff)
  question.push(0, 1)

  const header = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]

  return Buffer.from([...header, ...question])
}

function parseName(buf, offset) {
  const labels = []
  let jumped = false
  let originalOffset = offset

  while (offset < buf.length) {
    const len = buf[offset]
    if (len === 0) {
      offset++
      break
    }

    if ((len & 0xc0) === 0xc0) {
      if (!jumped) originalOffset = offset + 2
      offset = ((len & 0x3f) << 8) | buf[offset + 1]
      jumped = true
      continue
    }

    offset++
    labels.push(buf.slice(offset, offset + len).toString())
    offset += len
  }

  return { name: labels.join('.'), offset: jumped ? originalOffset : offset }
}

function parseTXT(rdata) {
  const txt = {}
  let pos = 0
  while (pos < rdata.length) {
    const len = rdata[pos++]
    if (len === 0 || pos + len > rdata.length) break
    const str = rdata.slice(pos, pos + len).toString()
    const eq = str.indexOf('=')
    if (eq > 0) {
      txt[str.slice(0, eq)] = str.slice(eq + 1)
    } else {
      txt[str] = true
    }
    pos += len
  }
  return txt
}

function parseRecords(buf) {
  const records = []

  if (buf.length < 12) return records

  const flags = (buf[2] << 8) | buf[3]
  if (!(flags & 0x8000)) return records

  const qdcount = (buf[4] << 8) | buf[5]
  const ancount = (buf[6] << 8) | buf[7]
  const nscount = (buf[8] << 8) | buf[9]
  const arcount = (buf[10] << 8) | buf[11]

  let offset = 12

  for (let i = 0; i < qdcount; i++) {
    if (offset >= buf.length) return records
    const result = parseName(buf, offset)
    offset = result.offset + 4
  }

  const totalRecords = ancount + nscount + arcount

  for (let i = 0; i < totalRecords; i++) {
    if (offset + 10 >= buf.length) break

    const nameResult = parseName(buf, offset)
    offset = nameResult.offset

    if (offset + 10 > buf.length) break

    const type = (buf[offset] << 8) | buf[offset + 1]
    const cls = (buf[offset + 2] << 8) | buf[offset + 3]
    const ttl =
      (buf[offset + 4] << 24) | (buf[offset + 5] << 16) | (buf[offset + 6] << 8) | buf[offset + 7]
    const rdlength = (buf[offset + 8] << 8) | buf[offset + 9]
    offset += 10

    if (offset + rdlength > buf.length) break

    const rdata = buf.slice(offset, offset + rdlength)
    const record = {
      name: nameResult.name,
      type,
      class: cls & 0x7fff,
      flush: !!(cls & 0x8000),
      ttl
    }

    switch (type) {
      case TYPE.A:
        if (rdlength === 4) {
          record.data = `${rdata[0]}.${rdata[1]}.${rdata[2]}.${rdata[3]}`
        }
        break

      case TYPE.AAAA:
        if (rdlength === 16) {
          const parts = []
          for (let j = 0; j < 16; j += 2) {
            parts.push(((rdata[j] << 8) | rdata[j + 1]).toString(16))
          }
          record.data = parts.join(':')
        }
        break

      case TYPE.PTR:
        record.data = parseName(buf, offset).name
        break

      case TYPE.TXT:
        record.data = parseTXT(rdata)
        break

      case TYPE.SRV:
        if (rdlength >= 6) {
          record.data = {
            priority: (rdata[0] << 8) | rdata[1],
            weight: (rdata[2] << 8) | rdata[3],
            port: (rdata[4] << 8) | rdata[5],
            target: parseName(buf, offset + 6).name
          }
        }
        break

      default:
        record.data = rdata
    }

    records.push(record)
    offset += rdlength
  }

  return records
}

class MDNS extends ReadyResource {
  constructor(opts = {}) {
    super()
    this.socket = null
    this.debug = opts.debug || false
  }

  _log(...args) {
    if (this.debug) console.log('[mdns]', ...args)
  }

  async _open() {
    this.socket = createSocket({ reuseAddress: true })

    this.socket.on('message', (msg, rinfo) => {
      this._log('received', msg.length, 'bytes from', rinfo.address)
      const records = parseRecords(msg)
      if (records.length) {
        this.emit('records', records, rinfo)
      }
    })

    this.socket.on('error', (err) => {
      this._log('socket error:', err)
      this.emit('error', err)
    })

    await new Promise((resolve) => {
      this.socket.bind(MDNS_PORT, () => {
        this._log('bound to port', MDNS_PORT)
        resolve()
      })
    })
  }

  query(name, type = TYPE.PTR) {
    if (!this.socket) return
    const q = buildQuery(name, type)
    this._log('query:', name, 'type:', type)
    this.socket.send(q, 0, q.length, MDNS_PORT, MDNS_ADDR)
  }

  async _close() {
    if (this.socket) {
      await this.socket.close()
      this.socket = null
    }
  }
}

class Discovery extends MDNS {
  constructor(opts = {}) {
    super(opts)
    this.service = opts.service
    this.services = new Map()
    this._interval = null
  }

  async _open() {
    await super._open()

    this.on('records', (records, rinfo) => {
      const service = this._parseService(records, rinfo)
      if (service && !this.services.has(service.uid)) {
        this.services.set(service.uid, service)
        this.emit('service', service)
      }
    })
  }

  // Override in subclass to parse service-specific records
  _parseService(records, rinfo) {
    const serviceSuffix = `._${this.service}._tcp.local`

    let name = null
    let txt = null
    let srv = null
    let ipv4 = null
    const ipv6 = []

    for (const r of records) {
      if (r.type === TYPE.PTR && r.name === `_${this.service}._tcp.local`) {
        name = r.data.replace(serviceSuffix, '')
      }
      if (r.type === TYPE.TXT && r.name.endsWith(serviceSuffix)) {
        txt = r.data
      }
      if (r.type === TYPE.SRV && r.name.endsWith(serviceSuffix)) {
        srv = r.data
      }
      if (r.type === TYPE.A) {
        ipv4 = r.data
      }
      if (r.type === TYPE.AAAA) {
        ipv6.push(r.data)
      }
    }

    if (!srv) return null

    return {
      uid: name || rinfo.address,
      name: name || 'Unknown',
      address: ipv4 || rinfo.address,
      addresses: { ipv4, ipv6 },
      port: srv.port,
      target: srv.target,
      txt: txt || {}
    }
  }

  discover(opts = {}) {
    const first = !!opts.first
    const timeout = opts.timeout || 10_000

    return new Promise((resolve) => {
      this.services.clear()

      const query = () => this.query(`_${this.service}._tcp.local`)
      query()
      this._interval = setInterval(query, 2000)

      if (first) {
        this.once('service', (s) => {
          clearInterval(this._interval)
          clearTimeout(timeoutId)
          resolve([s])
        })
      }

      const timeoutId = setTimeout(() => {
        if (this._interval) {
          clearInterval(this._interval)
          this._interval = null
        }
        resolve([...this.services.values()])
      }, timeout)
    })
  }

  async _close() {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
    await super._close()
  }
}

module.exports = MDNS
module.exports.MDNS = MDNS
module.exports.Discovery = Discovery
module.exports.TYPE = TYPE
module.exports.MDNS_ADDR = MDNS_ADDR
module.exports.MDNS_PORT = MDNS_PORT
