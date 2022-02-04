import * as t from 'typed-validators'

export type Zone = {
  Id: string
  Name: string
  Config: {
    PrivateZone: boolean
  }
}

export const ZoneType: t.TypeAlias<Zone>

export type ListHostedZonesByNameResponse = {
  HostedZones: Array<Zone>
  IsTruncated: boolean
  NextDNSName?: string | null
  NextHostedZoneId?: string | null
}

export const ListHostedZonesByNameResponseType: t.TypeAlias<ListHostedZonesByNameResponse>

export type ResourceRecord = {
  Value: string
}

export type AliasTarget = {
  DNSName: string
  EvaluateTargetHealth: boolean
  HostedZoneId: string
}

export type GeoLocation = {
  ContinentCode?: string
  CountryCode?: string
  SubdivisionCode?: string
}

export type ResourceRecordSetType =
  | 'SOA'
  | 'A'
  | 'TXT'
  | 'NS'
  | 'CNAME'
  | 'MX'
  | 'NAPTR'
  | 'PTR'
  | 'SRV'
  | 'SPF'
  | 'AAAA'
  | 'CAA'

export type Failover = 'PRIMARY' | 'SECONDARY'

export type ResourceRecordSet = {
  Name: string
  Type: ResourceRecordSetType
  AliasTarget?: AliasTarget
  Failover?: Failover
  GeoLocation?: GeoLocation
  HealthCheckId?: string
  MultiValueAnswer?: boolean
  Region?: string
  ResourceRecords?: Array<ResourceRecord>
  SetIdentifier?: string
  TTL?: number
  TrafficPolicyInstanceId?: string
  Weight?: number
}
