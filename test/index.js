// @flow

import { describe, it } from 'mocha'
import { expect } from 'chai'
import { findHostedZoneId } from '../src'

describe(`findHostedZoneId`, function() {
  it(`works`, async function(): Promise<void> {
    const zones = [
      {
        Id: '/hostedzone/AAAAAAAAAAAAA',
        Name: 'bar.io.',
        Config: { PrivateZone: false },
        ResourceRecordSetCount: 67,
      },
      {
        Id: '/hostedzone/BBBBBBBBBBBBB',
        Name: 'foo.io.',
        Config: { PrivateZone: true },
        ResourceRecordSetCount: 68,
      },
      {
        Id: '/hostedzone/AAAAAAAAAAAAA',
        Name: 'jcore.io.',
        Config: { PrivateZone: false },
        ResourceRecordSetCount: 67,
      },
      {
        Id: '/hostedzone/BBBBBBBBBBBBB',
        Name: 'jcore.io.',
        Config: { PrivateZone: true },
        ResourceRecordSetCount: 68,
      },
      {
        Id: '/hostedzone/CCCCCCCCCCCCC',
        Name: 'foo.jcore.io.',
        Config: { PrivateZone: false },
        ResourceRecordSetCount: 67,
      },
      {
        Id: '/hostedzone/DDDDDDDDDDDDD',
        Name: 'foo.jcore.io.',
        Config: { PrivateZone: true },
        ResourceRecordSetCount: 68,
      },
      {
        Id: '/hostedzone/EEEEEEEEEEEEE',
        Name: 'bar.jcore.io.',
        Config: { PrivateZone: false },
        ResourceRecordSetCount: 67,
      },
      {
        Id: '/hostedzone/FFFFFFFFFFFFF',
        Name: 'bar.jcore.io.',
        Config: { PrivateZone: true },
        ResourceRecordSetCount: 68,
      },
    ]

    const Route53 = {
      listHostedZonesByName: ({ DNSName, HostedZoneId }) => ({
        promise: () => {
          const i = zones.findIndex(
            z =>
              z.Id === HostedZoneId ||
              z.Name.endsWith(DNSName.replace(/\.?$/, '.'))
          )
          return Promise.resolve(
            i < 0
              ? { HostedZones: [], IsTruncated: false }
              : {
                  HostedZones: zones.slice(i, i + 2),
                  IsTruncated: i + 2 < zones.length,
                  NextHostedZoneId:
                    i + 2 < zones.length ? zones[i + 2].Id : null,
                  NextDNSName: i + 2 < zones.length ? zones[i + 2].Name : null,
                }
          )
        },
      }),
    }

    expect(
      await findHostedZoneId({
        DNSName: 'glob.foo.jcore.io',
        Route53,
      })
    ).to.equal('/hostedzone/CCCCCCCCCCCCC')
    expect(
      await findHostedZoneId({
        DNSName: 'glob.foo.jcore.io',
        PrivateZone: true,
        Route53,
      })
    ).to.equal('/hostedzone/DDDDDDDDDDDDD')
    expect(
      await findHostedZoneId({
        DNSName: 'glob.foo.blah.io',
        PrivateZone: true,
        Route53,
      })
    ).to.not.exist
  })
  it(`throws if response is invalid`, async function(): Promise<void> {
    const Route53 = {
      listHostedZonesByName: () => ({
        promise: () =>
          Promise.resolve({
            HostedZones: [
              {
                Id: 2,
                Name: 'foo',
              },
            ],
          }),
      }),
    }
    await expect(findHostedZoneId({ DNSName: 'test', Route53 })).to.be.rejected
  })
})
