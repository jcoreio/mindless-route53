/* @flow */

import AWS from 'aws-sdk'

function regexExtract(s: string, rx: RegExp): ?string {
  const match = rx.exec(s)
  return match ? match[0] : null
}

export async function findHostedZoneId(options: {
  DNSName: string,
  PrivateZone?: ?boolean,
  Route53?: ?AWS.Route53,
}): Promise<?string> {
  const origDNSName = options.DNSName
  const DNSName = options.DNSName.replace(/\.?$/, '.')
  const PrivateZone = Boolean(options.PrivateZone)

  const Route53 = options.Route53 || new AWS.Route53()

  const minDNSName = regexExtract(DNSName, /[^.]+\.[^.]+\.$/)
  if (!minDNSName) throw new Error(`Invalid DNSName: ${origDNSName}`)

  type Zone = {
    Id: string,
    Name: string,
    Config: {
      PrivateZone: boolean,
    },
  }

  async function* listZones(): AsyncIterable<Zone> {
    let {
      HostedZones,
      IsTruncated,
      NextDNSName,
      NextHostedZoneId,
    } = await Route53.listHostedZonesByName({
      DNSName: minDNSName,
    }).promise()
    yield* HostedZones
    while (IsTruncated) {
      ;({
        HostedZones,
        IsTruncated,
        NextDNSName,
        NextHostedZoneId,
      } = await Route53.listHostedZonesByName({
        DNSName: NextDNSName,
        HostedZoneId: NextHostedZoneId,
      }).promise())
      yield* HostedZones
    }
  }

  let best: ?Zone

  for await (let zone of listZones()) {
    const { Name, Config } = zone
    if (PrivateZone !== Config.PrivateZone) continue
    if (!DNSName.endsWith(Name)) break
    if (best == null || best.Name.length < Name.length) best = zone
  }
  return best ? best.Id : null
}
