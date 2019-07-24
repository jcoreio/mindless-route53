/* @flow */

import AWS from 'aws-sdk'

import { type Zone, ListHostedZonesByNameResponseType } from './AWSTypes'

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

  async function* listZones(): AsyncIterable<Zone> {
    const repsonse = await Route53.listHostedZonesByName({
      DNSName: minDNSName,
    }).promise()
    ListHostedZonesByNameResponseType.assert(repsonse)
    let { HostedZones, IsTruncated, NextDNSName, NextHostedZoneId } = repsonse
    yield* HostedZones
    while (IsTruncated) {
      const repsonse = await Route53.listHostedZonesByName({
        DNSName: NextDNSName,
        HostedZoneId: NextHostedZoneId,
      }).promise()
      ListHostedZonesByNameResponseType.assert(repsonse)
      ;({ HostedZones, IsTruncated, NextDNSName, NextHostedZoneId } = repsonse)
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
