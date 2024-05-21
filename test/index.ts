import { describe, it } from 'mocha'
import { assert, expect } from 'chai'
import {
  findHostedZoneId,
  upsertRecordSet,
  upsertPublicAndPrivateRecords,
} from '../src'
import {
  ResourceRecordSet,
  ChangeResourceRecordSetsRequest,
  ListHostedZonesByNameCommand,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
} from '@aws-sdk/client-route-53'

const HOSTED_ZONES = [
  {
    Id: '/hostedzone/AAAAAAAAAAAAA',
    Name: 'bar.io.',
    Config: {
      PrivateZone: false,
    },
    ResourceRecordSetCount: 67,
  },
  {
    Id: '/hostedzone/BBBBBBBBBBBBB',
    Name: 'foo.io.',
    Config: {
      PrivateZone: true,
    },
    ResourceRecordSetCount: 68,
  },
  {
    Id: '/hostedzone/AAAAAAAAAAAAA',
    Name: 'jcore.io.',
    Config: {
      PrivateZone: false,
    },
    ResourceRecordSetCount: 67,
  },
  {
    Id: '/hostedzone/BBBBBBBBBBBBB',
    Name: 'jcore.io.',
    Config: {
      PrivateZone: true,
    },
    ResourceRecordSetCount: 68,
  },
  {
    Id: '/hostedzone/CCCCCCCCCCCCC',
    Name: 'foo.jcore.io.',
    Config: {
      PrivateZone: false,
    },
    ResourceRecordSetCount: 67,
  },
  {
    Id: '/hostedzone/DDDDDDDDDDDDD',
    Name: 'foo.jcore.io.',
    Config: {
      PrivateZone: true,
    },
    ResourceRecordSetCount: 68,
  },
  {
    Id: '/hostedzone/EEEEEEEEEEEEE',
    Name: 'bar.jcore.io.',
    Config: {
      PrivateZone: false,
    },
    ResourceRecordSetCount: 67,
  },
  {
    Id: '/hostedzone/FFFFFFFFFFFFF',
    Name: 'bar.jcore.io.',
    Config: {
      PrivateZone: true,
    },
    ResourceRecordSetCount: 68,
  },
]
const changeResourceRecordSetsArgs: Array<ChangeResourceRecordSetsRequest> = []
const Route53: any = {
  async send(command: any) {
    if (command instanceof ListHostedZonesByNameCommand) {
      const { DNSName, HostedZoneId } = command.input
      const i = HOSTED_ZONES.findIndex(
        (z) =>
          z.Id === HostedZoneId ||
          (DNSName && z.Name.endsWith(DNSName.replace(/\.?$/, '.')))
      )
      return i < 0
        ? {
            HostedZones: [],
            IsTruncated: false,
          }
        : {
            HostedZones: HOSTED_ZONES.slice(i, i + 2),
            IsTruncated: i + 2 < HOSTED_ZONES.length,
            NextHostedZoneId:
              i + 2 < HOSTED_ZONES.length ? HOSTED_ZONES[i + 2].Id : null,
            NextDNSName:
              i + 2 < HOSTED_ZONES.length ? HOSTED_ZONES[i + 2].Name : null,
          }
    }
    if (command instanceof ChangeResourceRecordSetsCommand) {
      changeResourceRecordSetsArgs.push(command.input)
      return {
        ChangeInfo: {
          Id: 'xxxxxx',
        },
      }
    }
    if (command instanceof ListResourceRecordSetsCommand) {
      return {
        ResourceRecordSets: [],
      }
    }
  },
}
describe(`findHostedZoneId`, function () {
  it(`works`, async function (): Promise<undefined> {
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
})
describe(`upsertRecordSet`, function () {
  beforeEach(() => {
    changeResourceRecordSetsArgs.length = 0
  })
  it(`works for IP addresses`, async function (): Promise<undefined> {
    const Name = 'toyfactory.jcore.io'
    const Target = '1.2.3.4'
    const TTL = 360
    await upsertRecordSet({
      Name,
      Target,
      TTL,
      Route53,
      log: () => {},
      waitForChanges: false,
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
                ResourceRecords: [
                  {
                    Value: Target,
                  },
                ],
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
      waitForChanges: false,
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
                ResourceRecords: [
                  {
                    Value: Target,
                  },
                ],
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
  it(`works for DNS names`, async function (): Promise<undefined> {
    const Name = 'toyfactory.jcore.io'
    const Target = 'nlb--blah-blah-blah.jcore.io'
    const TTL = 360
    await upsertRecordSet({
      Name,
      Target,
      TTL,
      Route53,
      log: () => {},
      waitForChanges: false,
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
                ResourceRecords: [
                  {
                    Value: Target,
                  },
                ],
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
      waitForChanges: false,
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
                ResourceRecords: [
                  {
                    Value: Target,
                  },
                ],
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
  it(`works for ResourceRecordSets`, async function (): Promise<undefined> {
    const Name = 'toyfactory.jcore.io'
    const Target = 'nlb--blah-blah-blah.jcore.io'
    const TTL = 360
    const ResourceRecordSet: ResourceRecordSet = {
      Name,
      Type: 'CNAME',
      ResourceRecords: [
        {
          Value: Target,
        },
      ],
      TTL,
    } as const
    await upsertRecordSet({
      ResourceRecordSet,
      Route53,
      log: () => {},
      waitForChanges: false,
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
      waitForChanges: false,
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
  it('throws when hosted zone could not be found', async function (): Promise<undefined> {
    await expect(
      upsertRecordSet({
        Name: 'host.non.existent.domain',
        Target: '1.2.3.4',
        TTL: 60,
        Route53,
        log: () => {},
        waitForChanges: false,
      })
    ).to.be.eventually.rejectedWith('Failed to find an applicable hosted zone')
  })
  it(`doesn't upsert if record already exists`, async function (): Promise<undefined> {
    await upsertRecordSet({
      Name: 'blah.jcore.io',
      Target: '1.2.3.4',
      TTL: 60,
      Route53: {
        ...Route53,
        async send(command: any) {
          if (command instanceof ListResourceRecordSetsCommand) {
            return {
              ResourceRecordSets: [
                {
                  Name: 'blah.jcore.io.',
                  Type: 'A',
                  ResourceRecords: [
                    {
                      Value: '1.2.3.4',
                    },
                  ],
                  TTL: 60,
                },
              ],
            }
          }
          return await Route53.send(command)
        },
      } as any,
      log: () => {},
      waitForChanges: false,
    })
    expect(changeResourceRecordSetsArgs).to.deep.equal([])
  })
})
describe(`upsertPublicAndPrivateRecords`, function () {
  beforeEach(() => {
    changeResourceRecordSetsArgs.length = 0
  })
  it(`works for IP addresses`, async function (): Promise<undefined> {
    const Name = 'toyfactory.jcore.io'
    const PrivateTarget = '1.2.3.4'
    const PublicTarget = '5.6.7.8'
    const TTL = 360
    await upsertPublicAndPrivateRecords({
      Name,
      TTL,
      PrivateTarget,
      PublicTarget,
      Route53,
      log: () => {},
      waitForChanges: false,
    })
    const expectedChange = (privateZone: boolean) => ({
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name,
              Type: 'A',
              ResourceRecords: [
                {
                  Value: privateZone ? PrivateTarget : PublicTarget,
                },
              ],
              TTL,
            },
          },
        ],
        Comment: undefined,
      },
      HostedZoneId: privateZone
        ? '/hostedzone/BBBBBBBBBBBBB'
        : '/hostedzone/AAAAAAAAAAAAA',
    })
    expect(changeResourceRecordSetsArgs.length).to.equal(2)
    const privateChange = changeResourceRecordSetsArgs.find(
      (change) => '/hostedzone/BBBBBBBBBBBBB' === change.HostedZoneId
    )
    const publicChange = changeResourceRecordSetsArgs.find(
      (change) => '/hostedzone/AAAAAAAAAAAAA' === change.HostedZoneId
    )
    assert(privateChange, 'could not find change set for private zone')
    assert(publicChange, 'could not find change set for public zone')
    expect(privateChange).to.deep.equal(expectedChange(true))
    expect(publicChange).to.deep.equal(expectedChange(false))
  })
  it(`works for DNS names`, async function (): Promise<undefined> {
    const Name = 'toyfactory.jcore.io'
    const PrivateTarget = 'nlb--blah-blah-blah-private.jcore.io'
    const PublicTarget = 'nlb--blah-blah-blah-public.jcore.io'
    const TTL = 360
    await upsertPublicAndPrivateRecords({
      Name,
      TTL,
      PrivateTarget,
      PublicTarget,
      Route53,
      log: () => {},
      waitForChanges: false,
    })
    const expectedChange = (privateZone: boolean) => ({
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name,
              Type: 'CNAME',
              ResourceRecords: [
                {
                  Value: privateZone ? PrivateTarget : PublicTarget,
                },
              ],
              TTL,
            },
          },
        ],
        Comment: undefined,
      },
      HostedZoneId: privateZone
        ? '/hostedzone/BBBBBBBBBBBBB'
        : '/hostedzone/AAAAAAAAAAAAA',
    })
    expect(changeResourceRecordSetsArgs.length).to.equal(2)
    const privateChange = changeResourceRecordSetsArgs.find(
      (change) => '/hostedzone/BBBBBBBBBBBBB' === change.HostedZoneId
    )
    const publicChange = changeResourceRecordSetsArgs.find(
      (change) => '/hostedzone/AAAAAAAAAAAAA' === change.HostedZoneId
    )
    assert(privateChange, 'could not find change set for private zone')
    assert(publicChange, 'could not find change set for public zone')
    expect(privateChange).to.deep.equal(expectedChange(true))
    expect(publicChange).to.deep.equal(expectedChange(false))
  })
})
