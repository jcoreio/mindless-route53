#!/usr/bin/env node

// @ts-expect-error untyped
import yargs from 'yargs'
import { upsertRecordSet } from './index'
import { Route53Client } from '@aws-sdk/client-route-53'

yargs
  .command(
    'upsert',
    'upsert a resource record set',
    function (yargs: any) {
      yargs
        .usage(
          '$0 upsert --name <DNS name> --target <target IP(s) or DNS name(s)> --ttl <time to live> [--private] [--comment <comment>] [--region <AWS region>]'
        )
        .option('n', {
          alias: 'name',
          type: 'string',
          describe: 'the DNS name for the record set',
        })
        .option('t', {
          alias: 'target',
          type: 'string',
          describe:
            'the target IP address(es) for an A record or DNS name(s) for a CNAME record',
          array: true,
        })
        .option('ttl', {
          type: 'number',
          describe: 'the time-to-live for the record',
        })
        .option('private', {
          type: 'boolean',
          default: false,
          describe: 'whether to use the private hosted zone',
        })
        .option('c', {
          alias: 'comment',
          type: 'string',
          describe: 'a comment for the change',
        })
        .option('region', {
          type: 'string',
          describe: 'the AWS region',
        })
        .option('q', {
          alias: 'quiet',
          type: 'boolean',
          describe: 'suppress output',
        })
        .option('v', {
          alias: 'verbose',
          type: 'boolean',
          describe: 'enable verbose output',
        })
    },
    function (argv: any) {
      const {
        name: Name,
        target: Target,
        ttl: TTL,
        private: PrivateZone,
        comment: Comment,
        region,
        quiet,
        verbose,
      } = argv

      const Route53 = region ? new Route53Client({ region }) : undefined

      upsertRecordSet({
        Name,
        Target,
        TTL,
        PrivateZone,
        Comment,
        Route53,
        log: quiet ? () => {} : console.error.bind(console), // eslint-disable-line no-console
        verbose,
      }).then(
        () => process.exit(0),
        (err) => {
          if (!quiet) {
            console.error(err.stack) // eslint-disable-line no-console
          }
          process.exit(1)
        }
      )
    }
  )
  .demandCommand()
  .version()
  .help()

yargs.argv
