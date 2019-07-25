# mindless-route53

[![CircleCI](https://circleci.com/gh/jcoreio/mindless-route53.svg?style=svg)](https://circleci.com/gh/jcoreio/mindless-route53)
[![Coverage Status](https://codecov.io/gh/jcoreio/mindless-route53/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/mindless-route53)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/mindless-route53.svg)](https://badge.fury.io/js/mindless-route53)

low-mental-load API/CLI for AWS Route 53

<!-- toc -->

- [Node.js API](#nodejs-api)
  - [`findHostedZone(options)`](#findhostedzoneoptions)
  - [`findHostedZoneId(options)`](#findhostedzoneidoptions)
  - [`upsertRecordSet(options)`](#upsertrecordsetoptions)
- [CLI](#cli)
  - [`mroute53 upsert`](#mroute53-upsert)

<!-- tocstop -->

# Node.js API

## `findHostedZone(options)`

Finds the properties of the hosted zone whose name is the deepest superdomain of a given `DNSName`.

### `options`

#### `DNSName` (`string`, _required_)

the DNSName to search for, which can be

either the exact name of the hosted zone or a subdomain.

#### `PrivateZone` (`boolean`, _optional_)

whether to find a private zone

#### `Route53` (`AWS.Route53`, _optional_)

a Route53 client with your desired

settings.

### Returns

The properties of the hosted zone whose name is the deepest superdomain of the given `DNSName`.

## `findHostedZoneId(options)`

Like [`findHostedZoneId(options)`](#findhostedzoneidoptions), but just returns the zone id.

## `upsertRecordSet(options)`

Upserts a single DNS record set.

### `options`

#### `ResourceRecordSet` (`ResourceRecordSet`, _optional_)

a `ResourceRecordSet` as accepted by the AWS SDK for upsert
(you may provide this or `Name`/`Target`/`TTL`)

#### `Name` (`string`, _optional_)

the name of the record (required if `ResourceRecordSet` isn't given)

#### `Target` (`string | Array<string>`, _optional_)

the IP address value(s) for an A record or DNS name value(s) for a CNAME record (required if `ResourceRecordSet` isn't given)

#### `TTL` (`number`, _optional_)

the time to live (required if `ResourceRecordSet` isn't given)

#### `PrivateZone` (`boolean`, _optional_)

whether to use the private hosted zone

#### `Comment` (`string`, _optional_)

a comment for the upsert

#### `Route53` (`AWS.Route53`, _optional_)

a Route53 client with your desired

### Returns

The result of the `AWS.Route53.changeResourceRecordSets` call.

# CLI

You can use the `mindless-route53` or `mroute53` CLI command.

## `mroute53 upsert`

upsert a resource record set

### Usage

```
mroute53 upsert --name <DNS name> --target <target IP(s) or DNS name(s)> --ttl
<time to live> [--private] [--comment <comment>] [--region <AWS region>]
```

### Options

```
--version      Show version number                                   [boolean]
--help         Show help                                             [boolean]
-n, --name     the DNS name for the record set                        [string]
-t, --target   the target IP address(es) for an A record or DNS name(s) for a
               CNAME record                                            [array]
--ttl          the time-to-live for the record                        [number]
--private      whether to use the private hosted zone
                                                    [boolean] [default: false]
-c, --comment  a comment for the change                               [string]
--region       the AWS region                                         [string]
-q, --quiet    suppress output                                       [boolean]
-v, --verbose  enable verbose output                                 [boolean]
```
