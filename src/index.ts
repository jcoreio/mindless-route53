import {
  Route53Client,
  Route53ClientConfig,
  HostedZone,
  ResourceRecordSet,
  ChangeResourceRecordSetsRequest,
  ListHostedZonesByNameCommand,
  ListResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommand,
  waitUntilResourceRecordSetsChanged,
} from '@aws-sdk/client-route-53'
import isIp from 'is-ip'
// @ts-expect-error untyped
import deepEqual from 'deep-equal'

function regexExtract(s: string, rx: RegExp): string | undefined {
  const match = rx.exec(s)
  return match ? match[0] : undefined
}
export type FindHostedZonesOptions = {
  DNSName: string
  Route53?: Route53Client | undefined
  awsConfig?: Route53ClientConfig | undefined
}
export async function findHostedZones(
  options: FindHostedZonesOptions
): Promise<{
  PrivateHostedZone: HostedZone | undefined
  PublicHostedZone: HostedZone | undefined
}> {
  const origDNSName = options.DNSName
  const DNSName = options.DNSName.replace(/\.?$/, '.')
  const awsConfig = options.awsConfig || {}
  const Route53 = options.Route53 || new Route53Client(awsConfig)
  const minDNSName = regexExtract(DNSName, /[^.]+\.[^.]+\.$/)
  if (!minDNSName) throw new Error(`Invalid DNSName: ${origDNSName}`)
  let PrivateHostedZone: HostedZone | undefined = undefined
  let PublicHostedZone: HostedZone | undefined = undefined
  async function* listZones(): AsyncIterable<HostedZone> {
    const repsonse = await Route53.send(
      new ListHostedZonesByNameCommand({
        DNSName: minDNSName,
      })
    )
    let { HostedZones, IsTruncated, NextDNSName, NextHostedZoneId } = repsonse
    yield* HostedZones || []
    while (IsTruncated) {
      const repsonse = await Route53.send(
        new ListHostedZonesByNameCommand({
          DNSName: NextDNSName,
          HostedZoneId: NextHostedZoneId,
        })
      )
      ;({ HostedZones, IsTruncated, NextDNSName, NextHostedZoneId } = repsonse)
      yield* HostedZones || []
    }
  }
  for await (const zone of listZones()) {
    const { Name, Config } = zone
    if (!Name || !DNSName.endsWith(Name)) break
    if (Config?.PrivateZone) {
      if (
        !PrivateHostedZone?.Name ||
        Name.length > PrivateHostedZone.Name.length
      )
        PrivateHostedZone = zone
    } else {
      if (!PublicHostedZone?.Name || Name.length > PublicHostedZone.Name.length)
        PublicHostedZone = zone
    }
  }
  return {
    PrivateHostedZone,
    PublicHostedZone,
  }
}
export type FindHostedZoneOptions = {
  DNSName: string
  PrivateZone?: boolean
  Route53?: Route53Client
  awsConfig?: Route53ClientConfig
}
export async function findHostedZone({
  DNSName,
  PrivateZone,
  Route53,
  awsConfig,
}: FindHostedZoneOptions): Promise<HostedZone | undefined> {
  const { PrivateHostedZone, PublicHostedZone } = await findHostedZones({
    DNSName,
    Route53,
    awsConfig,
  })
  return PrivateZone ? PrivateHostedZone : PublicHostedZone
}
export type FindHostedZoneIdOptions = {
  DNSName: string
  PrivateZone?: boolean
  Route53?: Route53Client
  awsConfig?: Route53ClientConfig
}
export async function findHostedZoneId(
  options: FindHostedZoneIdOptions
): Promise<string | undefined> {
  const zone = await findHostedZone(options)
  return zone?.Id
}
function normalizeResourceRecordSet({
  Name,
  AliasTarget,
  ...rest
}: ResourceRecordSet): ResourceRecordSet {
  const result: ResourceRecordSet = {
    ...rest,
    Name: Name?.replace(/\.?$/, '.'),
  }
  if (AliasTarget) {
    const { DNSName, ...restAliasTarget } = AliasTarget
    result.AliasTarget = {
      ...restAliasTarget,
      DNSName: DNSName?.replace(/\.?$/, '.'),
    }
  }
  return result
}
async function alreadyExists({
  ResourceRecordSet,
  HostedZoneId,
  Route53,
}: {
  ResourceRecordSet: ResourceRecordSet
  HostedZoneId: string
  Route53: Route53Client
}): Promise<boolean> {
  const { ResourceRecordSets: [existing] = [] } = await Route53.send(
    new ListResourceRecordSetsCommand({
      HostedZoneId,
      StartRecordName: ResourceRecordSet.Name,
      StartRecordType: ResourceRecordSet.Type,
      MaxItems: 1,
    })
  )
  return deepEqual(normalizeResourceRecordSet(ResourceRecordSet), existing)
}
export type UpsertRecordSetOptions = {
  Name?: string
  Target?: string | Array<string>
  TTL?: number
  ResourceRecordSet?: ResourceRecordSet
  PrivateZone?: boolean
  HostedZone?: HostedZone
  Comment?: string
  Route53?: Route53Client
  awsConfig?: Route53ClientConfig
  waitForChanges?: boolean
  log?: (...args: Array<any>) => any
  verbose?: boolean
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
      ResourceRecords: Targets.map((Value) => ({
        Value,
      })),
      TTL,
    }
  }
  if (!ResourceRecordSet?.Name) throw new Error('this should never happen')
  const logPrefix = `[${ResourceRecordSet.Name}]`
  const awsConfig = options.awsConfig || {}
  const Route53 = options.Route53 || new Route53Client(awsConfig)
  if (!HostedZone) {
    if (verbose) log(logPrefix, `Finding hosted zone...`)
    HostedZone = await findHostedZone({
      DNSName: ResourceRecordSet.Name,
      PrivateZone,
      Route53,
      awsConfig,
    })
    if (!HostedZone) throw new Error('Failed to find an applicable hosted zone')
    if (verbose)
      log(
        logPrefix,
        `Found hosted zone: ${HostedZone.Id} (${HostedZone.Name} ${
          HostedZone.Config?.PrivateZone ? 'private' : 'public'
        })`
      )
  }
  const HostedZoneId = HostedZone.Id
  if (HostedZoneId == null) {
    throw new Error(`unexpected: HostedZone.Id is undefined`)
  }
  if (
    await alreadyExists({
      ResourceRecordSet,
      HostedZoneId,
      Route53,
    })
  ) {
    log(logPrefix, `An identical record already exists`)
    return
  }
  const changeOpts: ChangeResourceRecordSetsRequest = {
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
  const { ChangeInfo } = await Route53.send(
    new ChangeResourceRecordSetsCommand(changeOpts)
  )
  if (verbose) log(ChangeInfo)
  if (waitForChanges !== false) {
    log(logPrefix, `Waiting for change to complete...`)
    await waitUntilResourceRecordSetsChanged(
      { client: Route53, maxWaitTime: 3600 },
      {
        Id: ChangeInfo?.Id,
      }
    )
  }
  log(
    logPrefix,
    `Created record in ${HostedZone.Id} (${HostedZone.Name} ${
      HostedZone.Config?.PrivateZone ? 'private' : 'public'
    })`
  )
}
export async function upsertPublicAndPrivateRecords(options: {
  Name: string
  TTL?: number
  PrivateTarget: string | Array<string>
  PublicTarget: string | Array<string>
  PublicHostedZone?: HostedZone
  PrivateHostedZone?: HostedZone
  Route53?: Route53Client
  awsConfig?: Route53ClientConfig
  waitForChanges?: boolean
  log?: (...args: Array<any>) => any
  verbose?: boolean
}): Promise<void> {
  const {
    Name,
    TTL,
    PrivateTarget,
    PublicTarget,
    waitForChanges,
    log,
    verbose,
    awsConfig,
    Route53,
  } = options
  let { PublicHostedZone, PrivateHostedZone } = options
  if (!PublicHostedZone || !PrivateHostedZone) {
    ;({ PublicHostedZone, PrivateHostedZone } = await findHostedZones({
      DNSName: Name,
      Route53,
      awsConfig,
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
        awsConfig,
        waitForChanges,
        log,
        verbose,
      })
    )
  )
}
