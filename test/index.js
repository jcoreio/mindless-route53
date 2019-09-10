// @flow

import { describe, it } from 'mocha'
import { expect } from 'chai'
import { findHostedZoneId, upsertRecordSet } from '../src'

const HOSTED_ZONES = [
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

const changeResourceRecordSetsArgs = []

const Route53 = {
  listHostedZonesByName: ({ DNSName, HostedZoneId }) => ({
    promise: async () => {
      const i = HOSTED_ZONES.findIndex(
        z =>
          z.Id === HostedZoneId || z.Name.endsWith(DNSName.replace(/\.?$/, '.'))
      )
      return i < 0
        ? { HostedZones: [], IsTruncated: false }
        : {
            HostedZones: HOSTED_ZONES.slice(i, i + 2),
            IsTruncated: i + 2 < HOSTED_ZONES.length,
            NextHostedZoneId:
              i + 2 < HOSTED_ZONES.length ? HOSTED_ZONES[i + 2].Id : null,
            NextDNSName:
              i + 2 < HOSTED_ZONES.length ? HOSTED_ZONES[i + 2].Name : null,
          }
    },
  }),
  changeResourceRecordSets: arg => ({
    promise: async () => {
      changeResourceRecordSetsArgs.push(arg)
      return { ChangeInfo: { Id: 'xxxxxx' } }
    },
  }),
  waitFor: () => ({ promise: async () => {} }),
}

describe(`findHostedZoneId`, function() {
  it(`works`, async function(): Promise<void> {
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

describe(`upsertRecordSet`, function() {
  beforeEach(() => {
    changeResourceRecordSetsArgs.length = 0
  })

  it(`works for IP addresses`, async function(): Promise<void> {
    const Name = 'toyfactory.jcore.io'
    const Target = '1.2.3.4'
    const TTL = 360

    await upsertRecordSet({
      Name,
      Target,
      TTL,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name,
                Type: 'A',
                ResourceRecords: [{ Value: Target }],
                TTL,
              },
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/AAAAAAAAAAAAA',
      },
    ])

    changeResourceRecordSetsArgs.length = 0
    await upsertRecordSet({
      Name,
      Target,
      TTL,
      PrivateZone: true,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name,
                Type: 'A',
                ResourceRecords: [{ Value: Target }],
                TTL,
              },
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/BBBBBBBBBBBBB',
      },
    ])
  })
  it(`works for DNS names`, async function(): Promise<void> {
    const Name = 'toyfactory.jcore.io'
    const Target = 'nlb--blah-blah-blah.jcore.io'
    const TTL = 360

    await upsertRecordSet({
      Name,
      Target,
      TTL,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name,
                Type: 'CNAME',
                ResourceRecords: [{ Value: Target }],
                TTL,
              },
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/AAAAAAAAAAAAA',
      },
    ])

    changeResourceRecordSetsArgs.length = 0
    await upsertRecordSet({
      Name,
      Target,
      TTL,
      PrivateZone: true,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name,
                Type: 'CNAME',
                ResourceRecords: [{ Value: Target }],
                TTL,
              },
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/BBBBBBBBBBBBB',
      },
    ])
  })
  it(`works for ResourceRecordSets`, async function(): Promise<void> {
    const Name = 'toyfactory.jcore.io'
    const Target = 'nlb--blah-blah-blah.jcore.io'
    const TTL = 360

    const ResourceRecordSet = {
      Name,
      Type: 'CNAME',
      ResourceRecords: [{ Value: Target }],
      TTL,
    }

    await upsertRecordSet({
      ResourceRecordSet,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet,
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/AAAAAAAAAAAAA',
      },
    ])

    changeResourceRecordSetsArgs.length = 0
    await upsertRecordSet({
      ResourceRecordSet,
      PrivateZone: true,
      Route53,
      log: () => {},
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([
      {
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet,
            },
          ],
          Comment: undefined,
        },
        HostedZoneId: '/hostedzone/BBBBBBBBBBBBB',
      },
    ])
  })
})
