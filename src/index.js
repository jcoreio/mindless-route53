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

export async function findHostedZones(options: {
  DNSName: string,
  Route53?: ?AWS.Route53,
}): Promise<{
  PrivateHostedZone: ?Zone,
  PublicHostedZone: ?Zone,
}> {
  const origDNSName = options.DNSName
  const DNSName = options.DNSName.replace(/\.?$/, '.')

  const Route53 = options.Route53 || new AWS.Route53()

  const minDNSName = regexExtract(DNSName, /[^.]+\.[^.]+\.$/)
  if (!minDNSName) throw new Error(`Invalid DNSName: ${origDNSName}`)

  let PrivateHostedZone: ?Zone = null
  let PublicHostedZone: ?Zone = null

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

  for await (let zone of listZones()) {
    const { Name, Config } = zone
    if (!DNSName.endsWith(Name)) break
    if (Config.PrivateZone) {
      if (!PrivateHostedZone || Name.length > PrivateHostedZone.Name.length)
        PrivateHostedZone = zone
    } else {
      if (!PublicHostedZone || Name.length > PublicHostedZone.Name.length)
        PublicHostedZone = zone
    }
  }
  return { PrivateHostedZone, PublicHostedZone }
}

export async function findHostedZone({
  DNSName,
  PrivateZone,
  Route53,
}: {
  DNSName: string,
  PrivateZone?: ?boolean,
  Route53?: ?AWS.Route53,
}): Promise<?Zone> {
  const { PrivateHostedZone, PublicHostedZone } = await findHostedZones({
    DNSName,
    Route53,
  })
  return PrivateZone ? PrivateHostedZone : PublicHostedZone
}

export async function findHostedZoneId(options: {
  DNSName: string,
  PrivateZone?: ?boolean,
  Route53?: ?AWS.Route53,
}): Promise<?string> {
  const zone = await findHostedZone(options)
  return zone ? zone.Id : null
}

export async function upsertRecordSet(options: {
  Name?: string,
  Target?: string | Array<string>,
  TTL?: number,
  ResourceRecordSet?: _ResourceRecordSet,
  PrivateZone?: ?boolean,
  HostedZone?: ?Zone,
  Comment?: string,
  Route53?: AWS.Route53,
  log?: ?(...args: Array<any>) => any,
  verbose?: ?boolean,
}): Promise<void> {
  const { PrivateZone, Comment, verbose } = options
  const log = options.log || console.error.bind(console) // eslint-disable-line no-console
  let { ResourceRecordSet, HostedZone } = options
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
  if (!HostedZone) {
    if (verbose) log('Finding hosted zone...')
    HostedZone = await findHostedZone({
      DNSName: ResourceRecordSet.Name,
      PrivateZone,
      Route53,
    })
    if (!HostedZone) throw new Error('Failed to find an applicable hosted zone')
    if (verbose)
      log(
        `Found hosted zone: ${HostedZone.Id} (${HostedZone.Name} ${
          HostedZone.Config.PrivateZone ? 'private' : 'public'
        })`
      )
  }

  const changeOpts = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet,
        },
      ],
      Comment,
    },
    HostedZoneId: HostedZone.Id,
  }
  log('Calling changeResourceRecordSets...')
  if (verbose) log(JSON.stringify(changeOpts, null, 2))
  const { ChangeInfo } = await Route53.changeResourceRecordSets(
    changeOpts
  ).promise()

  if (verbose) log(ChangeInfo)

  log('Waiting for change to complete...')
  await Route53.waitFor('resourceRecordSetsChanged', {
    Id: ChangeInfo.Id,
  }).promise()

  log(
    `Created record for ${ResourceRecordSet.Name} in ${HostedZone.Id} (${
      HostedZone.Name
    } ${HostedZone.Config.PrivateZone ? 'private' : 'public'})`
  )
}

export async function upsertPublicAndPrivateRecords(options: {
  Name: string,
  TTL?: number,
  PrivateTarget: string | Array<string>,
  PublicTarget: string | Array<string>,
  PublicHostedZone?: ?Zone,
  PrivateHostedZone?: ?Zone,
  Route53?: AWS.Route53,
  log?: ?(...args: Array<any>) => any,
  verbose?: ?boolean,
}): Promise<void> {
  const { Name, TTL, PrivateTarget, PublicTarget, log, verbose } = options
  let { PublicHostedZone, PrivateHostedZone, Route53 } = options
  Route53 = Route53 || new AWS.Route53()
  if (!PublicHostedZone || !PrivateHostedZone) {
    ;({ PublicHostedZone, PrivateHostedZone } = await findHostedZones({
      DNSName: Name,
      Route53,
    }))
    if (!PublicHostedZone && !PrivateHostedZone)
      throw Error(`unable to find public or private zones for ${Name}`)
    if (!PublicHostedZone) throw Error(`unable to find public zone for ${Name}`)
    if (!PrivateHostedZone)
      throw Error(`unable to find private zone for ${Name}`)
  }
  await Promise.all(
    [true, false].map((privateZone: boolean) =>
      upsertRecordSet({
        Name,
        Target: privateZone ? PrivateTarget : PublicTarget,
        TTL,
        PrivateZone: privateZone,
        HostedZone: privateZone ? PrivateHostedZone : PublicHostedZone,
        Route53,
        log,
        verbose,
      })
    )
  )
}
