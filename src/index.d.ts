import AWS from 'aws-sdk'

import { Zone, ResourceRecordSet as _ResourceRecordSet } from './AWSTypes'

export type FindHostedZonesOptions = {
  DNSName: string
  Route53?: AWS.Route53 | null
  awsConfig?: AWS.ConfigurationOptions | null
}

export function findHostedZones(options: FindHostedZonesOptions): Promise<{
  PrivateHostedZone: Zone | null
  PublicHostedZone: Zone | null
}>

export type FindHostedZoneOptions = {
  DNSName: string
  PrivateZone?: boolean | null
  Route53?: AWS.Route53 | null
  awsConfig?: AWS.ConfigurationOptions | null
}

export function findHostedZone(
  options: FindHostedZoneOptions
): Promise<Zone | null>

export type FindHostedZoneIdOptions = {
  DNSName: string
  PrivateZone?: boolean | null
  Route53?: AWS.Route53 | null
  awsConfig?: AWS.ConfigurationOptions | null
}

export function findHostedZoneId(
  options: FindHostedZoneIdOptions
): Promise<string | null>

export type UpsertRecordSetOptions = {
  Name?: string
  Target?: string | Array<string>
  TTL?: number
  ResourceRecordSet?: _ResourceRecordSet
  PrivateZone?: boolean | null
  HostedZone?: Zone | null
  Comment?: string
  Route53?: AWS.Route53
  awsConfig?: AWS.ConfigurationOptions | null
  waitForChanges?: boolean | null
  log?: ((...args: Array<any>) => any) | null
  verbose?: boolean | null
}

export function upsertRecordSet(options: UpsertRecordSetOptions): Promise<void>

export function upsertPublicAndPrivateRecords(options: {
  Name: string
  TTL?: number
  PrivateTarget: string | Array<string>
  PublicTarget: string | Array<string>
  PublicHostedZone?: Zone | null
  PrivateHostedZone?: Zone | null
  Route53?: AWS.Route53
  awsConfig?: AWS.ConfigurationOptions
  waitForChanges?: boolean | null
  log?: ((...args: Array<any>) => any) | null
  verbose?: boolean | null
}): Promise<void>
