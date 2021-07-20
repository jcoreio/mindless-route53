/* @flow */

import AWS from 'aws-sdk'
import isIp from 'is-ip'
import deepEqual from 'deep-equal'

import {
  type Zone,
  ListHostedZonesByNameResponseType,
  type ResourceRecordSet as _ResourceRecordSet,
} from './AWSTypes'

function regexExtract(s: string, rx: RegExp): ?string {
  const match = rx.exec(s)
  return match ? match[0] : null
}

export type FindHostedZonesOptions = {
  DNSName: string,
  Route53?: ?AWS.Route53,
}

export async function findHostedZones(
  options: FindHostedZonesOptions
): Promise<{
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

export type FindHostedZoneOptions = {
  DNSName: string,
  PrivateZone?: ?boolean,
  Route53?: ?AWS.Route53,
}

export async function findHostedZone({
  DNSName,
  PrivateZone,
  Route53,
}: FindHostedZoneOptions): Promise<?Zone> {
  const { PrivateHostedZone, PublicHostedZone } = await findHostedZones({
    DNSName,
    Route53,
  })
  return PrivateZone ? PrivateHostedZone : PublicHostedZone
}

export type FindHostedZoneIdOptions = {
  DNSName: string,
  PrivateZone?: ?boolean,
  Route53?: ?AWS.Route53,
}

export async function findHostedZoneId(
  options: FindHostedZoneIdOptions
): Promise<?string> {
  const zone = await findHostedZone(options)
  return zone ? zone.Id : null
}

function normalizeResourceRecordSet({
  Name,
  AliasTarget,
  ...rest
}: _ResourceRecordSet): _ResourceRecordSet {
  const result: _ResourceRecordSet = {
    Name: Name.replace(/\.?$/, '.'),
    ...rest,
  }
  if (AliasTarget) {
    const { DNSName, ...restAliasTarget } = AliasTarget
    result.AliasTarget = {
      DNSName: DNSName.replace(/\.?$/, '.'),
      ...restAliasTarget,
    }
  }
  return result
}

async function alreadyExists({
  ResourceRecordSet,
  HostedZoneId,
  Route53,
}: {
  ResourceRecordSet: _ResourceRecordSet,
  HostedZoneId: string,
  Route53: AWS.Route53,
}): Promise<boolean> {
  const {
    ResourceRecordSets: [existing],
  } = await Route53.listResourceRecordSets({
    HostedZoneId,
    StartRecordName: ResourceRecordSet.Name,
    StartRecordType: ResourceRecordSet.Type,
    MaxItems: '1',
  }).promise()
  return deepEqual(normalizeResourceRecordSet(ResourceRecordSet), existing)
}

export type UpsertRecordSetOptions = {
  Name?: string,
  Target?: string | Array<string>,
  TTL?: number,
  ResourceRecordSet?: _ResourceRecordSet,
  PrivateZone?: ?boolean,
  HostedZone?: ?Zone,
  Comment?: string,
  Route53?: AWS.Route53,
  waitForChanges?: ?boolean,
  log?: ?(...args: Array<any>) => any,
  verbose?: ?boolean,
}

export async function upsertRecordSet(
  options: UpsertRecordSetOptions
): Promise<void> {
  const { PrivateZone, Comment, waitForChanges, verbose } = options
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

  const logPrefix = `[${ResourceRecordSet.Name}]`

  const Route53 = options.Route53 || new AWS.Route53()
  if (!HostedZone) {
    if (verbose) log(logPrefix, `Finding hosted zone...`)
    HostedZone = await findHostedZone({
      DNSName: ResourceRecordSet.Name,
      PrivateZone,
      Route53,
    })
    if (!HostedZone) throw new Error('Failed to find an applicable hosted zone')
    if (verbose)
      log(
        logPrefix,
        `Found hosted zone: ${HostedZone.Id} (${HostedZone.Name} ${
          HostedZone.Config.PrivateZone ? 'private' : 'public'
        })`
      )
  }

  if (
    await alreadyExists({
      ResourceRecordSet,
      HostedZoneId: HostedZone.Id,
      Route53,
    })
  ) {
    log(logPrefix, `An identical record already exists`)
    return
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
  log(logPrefix, `Calling changeResourceRecordSets...`)
  if (verbose) log(JSON.stringify(changeOpts, null, 2))
  const { ChangeInfo } = await Route53.changeResourceRecordSets(
    changeOpts
  ).promise()

  if (verbose) log(ChangeInfo)

  if (waitForChanges !== false) {
    log(logPrefix, `Waiting for change to complete...`)
    await Route53.waitFor('resourceRecordSetsChanged', {
      Id: ChangeInfo.Id,
    }).promise()
  }

  log(
    logPrefix,
    `Created record in ${HostedZone.Id} (${HostedZone.Name} ${
      HostedZone.Config.PrivateZone ? 'private' : 'public'
    })`
  )
}

export async function upsertPublicAndPrivateRecords(options: {
  Name: string,
  TTL?: number,
  PrivateTarget?: string | Array<string>,
  PublicTarget?: string | Array<string>,
  PublicHostedZone?: ?Zone,
  PrivateHostedZone?: ?Zone,
  Route53?: AWS.Route53,
  waitForChanges?: ?boolean,
  log?: ?(...args: Array<any>) => any,
  verbose?: ?boolean,
}): Promise<void> {
  const {
    Name,
    TTL,
    PrivateTarget,
    PublicTarget,
    waitForChanges,
    log,
    verbose,
  } = options
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
    [true, false].map(async (privateZone: boolean) => {
      const Target = privateZone ? PrivateTarget : PublicTarget
      if (Target)
        await upsertRecordSet({
          Name,
          Target,
          TTL,
          PrivateZone: privateZone,
          HostedZone: privateZone ? PrivateHostedZone : PublicHostedZone,
          Route53,
          waitForChanges,
          log,
          verbose,
        })
    })
  )
}
