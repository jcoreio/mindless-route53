# mindless-route53

[![CircleCI](https://circleci.com/gh/jcoreio/mindless-route53.svg?style=svg)](https://circleci.com/gh/jcoreio/mindless-route53)
[![Coverage Status](https://codecov.io/gh/jcoreio/mindless-route53/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/mindless-route53)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/mindless-route53.svg)](https://badge.fury.io/js/mindless-route53)

low-mental-load API/CLI for AWS Route 53

# Node.js API

## `findHostedZoneId(options)`

Finds the Id of the hosted zone whose name is the deepest superdomain of a given `DNSName`.

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

The Id of the hosted zone whose name is the deepest superdomain of the given `DNSName`.

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
