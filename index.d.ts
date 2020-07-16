import AWS from 'aws-sdk'

export type FindHostedZonesOptions = {
  DNSName: string
  Route53?: AWS.Route53 | null | undefined
}

export function findHostedZones(
  options: FindHostedZonesOptions
): Promise<{
  PrivateHostedZone: AWS.Route53.HostedZone | null | undefined
  PublicHostedZone: AWS.Route53.HostedZone | null | undefined
}>

export type FindHostedZoneOptions = {
  DNSName: string
  PrivateZone?: boolean | null | undefined
  Route53?: AWS.Route53 | null | undefined
}

export function findHostedZone(
  options: FindHostedZoneOptions
): Promise<AWS.Route53.HostedZone | null | undefined>

export type FindHostedZoneIdOptions = {
  DNSName: string
  PrivateZone?: boolean | null | undefined
  Route53?: AWS.Route53 | null | undefined
}

export function findHostedZoneId(
  options: FindHostedZoneIdOptions
): Promise<string | null | undefined>

export type UpsertRecordSetOptions = {
  Name?: string | null | undefined
  Target?: string | Array<string> | null | undefined
  TTL?: number | null | undefined
  ResourceRecordSet?: AWS.Route53.ResourceRecordSet | null | undefined
  PrivateZone?: boolean | null | undefined
  Comment?: string | null | undefined
  Route53?: AWS.Route53 | null | undefined
  waitForChanges?: boolean | null | undefined
  log?: ((...args: Array<any>) => any) | null | undefined
  verbose?: boolean | null | undefined
}

export function upsertRecordSet(options: UpsertRecordSetOptions): Promise<void>

export type UpsertPublicAndPrivateRecordsOptions = {
  Name: string
  TTL?: number
  PrivateTarget: string | Array<string>
  PublicTarget: string | Array<string>
  PublicHostedZone?: AWS.Route53.HostedZone | null | undefined
  PrivateHostedZone?: AWS.Route53.HostedZone | null | undefined
  Route53?: AWS.Route53 | null | undefined
  waitForChanges?: boolean | null | undefined
  log?: ((...args: Array<any>) => any) | null | undefined
  verbose?: boolean | null | undefined
}

export function upsertPublicAndPrivateRecords(
  options: UpsertPublicAndPrivateRecordsOptions
): Promise<void>
