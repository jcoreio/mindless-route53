// @flow

import * as t from 'typed-validators'

export type Zone = {
  Id: string,
  Name: string,
  Config: {
    PrivateZone: boolean,
  },
}

export const ZoneType: t.TypeAlias<Zone> = t.alias(
  'Zone',
  t.object({
    exact: false,

    required: {
      Id: t.string(),
      Name: t.string(),

      Config: t.object({
        exact: false,

        required: {
          PrivateZone: t.boolean(),
        },
      }),
    },
  })
)

export type ListHostedZonesByNameResponse = {
  HostedZones: Array<Zone>,
  IsTruncated: boolean,
  NextDNSName?: ?string,
  NextHostedZoneId?: ?string,
}

export const ListHostedZonesByNameResponseType: t.TypeAlias<ListHostedZonesByNameResponse> =
  t.alias(
    'ListHostedZonesByNameResponse',
    t.object({
      exact: false,

      required: {
        HostedZones: t.array(t.ref(() => ZoneType)),
        IsTruncated: t.boolean(),
      },

      optional: {
        NextDNSName: t.nullishOr(t.string()),
        NextHostedZoneId: t.nullishOr(t.string()),
      },
    })
  )

export type ResourceRecord = {
  Value: string,
}

export type AliasTarget = {
  DNSName: string,
  EvaluateTargetHealth: boolean,
  HostedZoneId: string,
}

export type GeoLocation = {
  ContinentCode?: string,
  CountryCode?: string,
  SubdivisionCode?: string,
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
  Name: string,
  Type: ResourceRecordSetType,
  AliasTarget?: AliasTarget,
  Failover?: Failover,
  GeoLocation?: GeoLocation,
  HealthCheckId?: string,
  MultiValueAnswer?: boolean,
  Region?: string,
  ResourceRecords?: Array<ResourceRecord>,
  SetIdentifier?: string,
  TTL?: number,
  TrafficPolicyInstanceId?: string,
  Weight?: number,
}
