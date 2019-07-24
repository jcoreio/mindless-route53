// @flow
// @flow-runtime enable

import reify from 'flow-runtime'
import { type Type } from 'flow-runtime'

export type Zone = {
  Id: string,
  Name: string,
  Config: {
    PrivateZone: boolean,
  },
}

export const ZoneType = (reify: Type<Zone>)

export type ListHostedZonesByNameResponse = {
  HostedZones: Array<Zone>,
  IsTruncated: boolean,
  NextDNSName?: ?string,
  NextHostedZoneId?: ?string,
}

export const ListHostedZonesByNameResponseType = (reify: Type<ListHostedZonesByNameResponse>)
