/* @flow */

import AWS from 'aws-sdk'
import isIp from 'is-ip'

import {
  type Zone,
  ListHostedZonesByNameResponseType,
  type ResourceRecordSet as _ResourceRecordSet,
} from './AWSTypes'

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

export async function upsertRecordSet(options: {
  Name?: string,
  Target?: string | Array<string>,
  TTL?: number,
  ResourceRecordSet?: _ResourceRecordSet,
  PrivateZone?: ?boolean,
  Comment?: string,
  Route53?: AWS.Route53,
}): Promise<void> {
  const { PrivateZone, Comment } = options
  let { ResourceRecordSet } = options
  if (!ResourceRecordSet) {
    const { Name, Target, TTL } = options
    if (!Name)
      throw new Error('Name must be provided if ResourceRecordSet is missing')
    if (!Target || !Target.length)
      throw new Error('Target must be provided if ResourceRecordSet is missing')
    if (TTL == null)
      throw new Error('TTL must be provided if ResourceRecordSet is missing')
    const Targets = Array.isArray(Target) ? Target : [Target]
    const targetIsIp = isIp(Targets[0])
    Targets.forEach((Value: string) => {
      if (isIp(Value) !== targetIsIp) {
        throw new Error(
          'Target array must be all IP addresses or all DNS names'
        )
      }
    })
    const Type = targetIsIp ? 'A' : 'CNAME'

    ResourceRecordSet = {
      Name,
      Type,
      ResourceRecords: Targets.map(Value => ({ Value })),
      TTL,
    }
  }
  if (!ResourceRecordSet) throw new Error('this should never happen')

  const Route53 = options.Route53 || new AWS.Route53()
  const HostedZoneId = await findHostedZoneId({
    DNSName: ResourceRecordSet.Name,
    PrivateZone,
    Route53,
  })

  return await Route53.changeResourceRecordSets({
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet,
        },
      ],
      Comment,
    },
    HostedZoneId,
  }).promise()
}
