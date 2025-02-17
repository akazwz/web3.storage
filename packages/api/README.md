# web3.storage API

The HTTP interface implemented as a Cloudflare Worker

## Getting started

Copy the `.env.tpl` to `.env` in root of the project monorepo. 

Create an account on https://magic.link and fill in the `MAGIC_SECRET_KEY` variable in the .env file.

We use miniflare to run the api locally, and docker to run ipfs-cluster and postgres with postREST.

```sh
# Install the deps
npm install
```

With docker running locally, start all the things:

```
npm start
```

🎉 miniflare is running in watch mode; you can save changes to the api code and the worker will update.

Kill the process to stop miniflare, then run `npm run stop` to shutdown the cluster and postgres

```sh
npm run stop
```

## Setting up a cloudflare worker

One time set up of your cloudflare worker subdomain. You only need to do this if you want to test in a real cloudflare worker.

- `npm install` - Install the project dependencies
- Sign up to Cloudflare and log in with your default browser.
- `npm i @cloudflare/wrangler -g` - Install the Cloudflare wrangler CLI
- `wrangler login` - Authenticate your wrangler cli; it'll open your browser.
- Setup Cluster
  - You need to run a cluster locally and make it accessible from the internet for development. 
    ```
    npm run cluster:start
    ```
    to start the IPFS cluster.

    You can stop the cluster by
    ```
    npm run cluster:stop
    ```

    The data is persisted among different runs, if you'd like to reset your cluster you can run
    ```
    npm run cluster:reset
    ```
  - 
    ```sh
    npm install -g localtunnel
    npm run lt:cluster
    ```

    - There is an npm script you can use to quickly establish these tunnels during development:

    ```sh
    npm run lt
    ```
- Copy your cloudflare account id from `wrangler whoami`
- Setup database
    - For setting up a local database check [Local DB setup](../db/README.md).
    - Once a DB is running, you will need a local tunnel similar to cluster:

    ```sh
    npm run lt:postgres
    ```
- Update `wrangler.toml` with a new `env`. Set your env name to be the value of `whoami` on your system you can use `npm start` to run the worker in dev mode for you.

    [**wrangler.toml**](./wrangler.toml)

    ```toml
    [env.bobbytables]
    workers_dev = true
    account_id = "<what does the `wrangler whoami` say>"
    vars = { CLUSTER_API_URL = "https://USER-cluster-api-web3-storage.loca.lt", PG_REST_URL = "https://USER-postgres-api-web3-storage.loca.lt", ENV = "dev" }
    ```

- `npm run build` - Build the bundle
- Add secrets

    ```sh
    wrangler secret put MAGIC_SECRET_KEY --env $(whoami) # Get from magic.link account
    wrangler secret put SALT --env $(whoami) # open `https://csprng.xyz/v1/api` in the browser and use the value of `Data`
    wrangler secret put CLUSTER_BASIC_AUTH_TOKEN --env $(whoami) # Get from web3.storage vault in 1password (not required for dev)
    wrangler secret put SENTRY_DSN --env $(whoami) # Get from Sentry (not required for dev)
    wrangler secret put S3_BUCKET_REGION --env $(whoami) # e.g us-east-2 (not required for dev)
    wrangler secret put S3_ACCESS_KEY_ID --env $(whoami) # Get from Amazon S3 (not required for dev)
    wrangler secret put S3_SECRET_ACCESS_KEY_ID --env $(whoami) # Get from Amazon S3 (not required for dev)
    wrangler secret put S3_BUCKET_NAME --env $(whoami) # e.g web3.storage-staging-us-east-2 (not required for dev)
    wrangler secret put PG_REST_JWT --env $(whoami) # Get from database postgrest
    ```

- `npm run publish` - Publish the worker under your env. An alias for `wrangler publish --env $(whoami)`
- `npm start` - Run the worker in dev mode. An alias for `wrangler dev --env $(whoami)

You only need to `npm start` for subsequent runs. PR your env config to the wrangler.toml, to celebrate 🎉

## Maintenance Mode

The API can be put into maintenance mode to prevent writes or prevent reads _and_ writes.

To change the maintenance mode for the API, issue the following command:

```sh
wrangler secret put MAINTENANCE_MODE --env production
```

When prompted for a value enter one of the following permission combinations:

- `--` = no reading or writing
- `r-` = read only mode
- `rw` = read and write (normal operation)

## API

The given API has a set of three different authentication levels:

- 🤲 Public
- 🔒 API or Magic Token
- 👮 Magic Token (admin operations)

The 👮 API methods are only allowed with a Magic Token, and consequently only available via https://web3.storage

### 🔒 `POST /car`

Upload a CAR file for a root CID. _Authenticated_

```console
curl -X POST --data-binary @x.car -H 'Authorization: Bearer YOUR_API_KEY' http://127.0.0.1:8787/car -s | jq
{
  "cid":"bafybeid4nimtvdhnawjbpakmw3cijjolgmdfhigd6bveb4rtxp33elfm6q"
}
```

You can also provide a name for the file using the header `X-NAME`, but be sure to encode the filename first. For example `LICENSE–MIT` should be sent as `LICENSE%E2%80%93MIT`.

### 🔒 `POST /upload`

Upload a file for a root CID (maximum of 100 MB). _Authenticated_

```console
curl -X POST --data-binary @file.txt -H 'Authorization: Bearer YOUR_API_KEY' http://127.0.0.1:8787/upload  -s | jq
{
  "cid":"bafkreid65ervf7fmfnbhyr2uqiqipufowox4tgkrw4n5cxgeyls4mha3ma"
}
```

You can also provide a name for the file using the header `X-NAME`, but be sure to encode the filename first. For example `LICENSE–MIT` should be sent as `LICENSE%E2%80%93MIT`.

### 🔒 `GET /user/uploads`

Get a list of user uploads. _Authenticated_

```console
curl -H 'Authorization: Bearer YOUR_API_KEY' 'http://127.0.0.1:8787/user/uploads' -s | jq
{
  "cid": "bafybeidwfngv7n5y7ydbzotrwl3gohgr2lv2g7vn6xggwcjzrf5emknrki",
  "created": "2021-07-29T09:08:28.295905Z",
  "dagSize": 112202,
  "pins": [
    {
      "status": "Pinned",
      "updated": "2021-07-29T09:08:28.295905Z",
      "peerId": "12D3KooWFe387JFDpgNEVCP5ARut7gRkX7YuJCXMStpkq714ziK6",
      "peerName": "web3-storage-sv15",
      "region": "US-CA"
    }
  ],
  "deals": []
```

By default, 25 uploads are requested, but more can be requested up to a maximum of 1000. A `size` parameter should be used as follows:

```console
curl -H 'Authorization: Bearer YOUR_API_KEY' 'http://127.0.0.1:8787/user/uploads?size=1000'
```

### 🤲 `GET /car/:cid`

Get the CAR file containing all blocks in the tree starting at the root `:cid`

```console
$ curl -sD - 'http://127.0.0.1:8787/car/bafybeidd2gyhagleh47qeg77xqndy2qy3yzn4vkxmk775bg2t5lpuy7pcu'
HTTP/1.1 200 OK
date: Mon, 14 Jun 2021 09:12:41 GMT
content-type: application/car
cache-control: public, max-age=10
content-disposition: attachment; filename="bafybeidd2gyhagleh47qeg77xqndy2qy3yzn4vkxmk775bg2t5lpuy7pcu.car"
```

### 🤲 `HEAD /car/:cid`

Get the size of a CAR file for all blocks in the tree starting at the root `:cid` as the

```console
$ curl -I 'http://127.0.0.1:8787/car/bafybeidd2gyhagleh47qeg77xqndy2qy3yzn4vkxmk775bg2t5lpuy7pcu'
HTTP/1.1 200 OK
date: Mon, 14 Jun 2021 08:30:56 GMT
content-length: 564692
```

### 🤲 `GET /status/:cid`

Get pinning status and filecoin deals info for a CID.

```console
$ curl 'http://127.0.0.1:8787/status/bafybeidwfngv7n5y7ydbzotrwl3gohgr2lv2g7vn6xggwcjzrf5emknrki' -s | jq
{
  "cid": "bafybeidwfngv7n5y7ydbzotrwl3gohgr2lv2g7vn6xggwcjzrf5emknrki",
  "created": "2021-07-14T19:55:49.409306Z",
  "dagSize": null,
  "pins": [],
  "deals": []
}
```

### 🤲 `POST /user/login`

Proceed to user login (or register).

### 👮 `DELETE /user/uploads/:cid`

Delete a given user upload by its root CID.

### 👮 `GET /user/tokens`

Get list of user tokens.

### 👮 `POST /user/tokens`

Create a new user token.

### 👮 `DELETE /user/tokens/:id`

Delete a given user token.

### 👮 `GET /user/account`

Get the user account information.

### 🔒 `POST /name/:key`

**❗️Experimental** this API may not work, may change, and may be removed in a future version.

Publish a name record for the given key ID.

Users create a keypair<sup>*</sup> and derive a **Key ID** from the public key that acts as the "name".

<details>
  <summary>What is the Key ID?</summary>
  <p>The Key ID is the base36 "libp2p-key" encoding of the public key. The public key is protobuf encoded and contains <code>Type</code> and <code>Data</code> properties, see <a href="https://github.com/libp2p/js-libp2p-crypto/blob/c29c1490bbd25722437fdb36f2f0d1a705f35909/src/keys/ed25519-class.js#L25-L30"><code>ed25519-class.js</code> for example</a>.</p>
</details>

The updated IPNS record is signed with the private key and sent in the request body (base 64 encoded). The server validates the record and ensures the sequence number is greater than the sequence number of any cached record.

<sup>*</sup> Currently a Ed25519 2048 bit (min) key.

### 🤲 `GET /name/:key`

**❗️Experimental** this API may not work, may change, and may be removed in a future version.

Resolve the current CID for the given key ID.

Users "resolve" a Key ID to the current _value_ of a _record_. Typically an IPFS path. Keypair owners "publish" IPNS _records_ to create or update the current _value_.

It returns the resolved value AND the full name record (base 64 encoded, for client side verification).

### 🤲 `GET /name/:key/watch`

**❗️Experimental** this API may not work, may change, and may be removed in a future version.

Watch for changes to the given key ID over a websocket connection.

When changes to the `:key` are published, a JSON encoded message is sent over the websocket containing the new value and the full name record (base 64 encoded, for client side verification).

## Setup Sentry

Inside the `/packages/api` folder create a file called `.env.local` with the following content.

Note: tokens can be created here https://sentry.io/settings/account/api/auth-tokens/ and need the following scopes `event:admin` `event:read` `member:read` `org:read` `project:read` `project:releases` `team:read`.

```ini
SENTRY_TOKEN=<sentry user auth token>
SENTRY_UPLOAD=false # toggle for sentry source/sourcemaps upload (capture will still work)
```

Production vars should be set in Github Actions secrets.

## S3 Setup

We use [S3](https://aws.amazon.com/s3/) for backup and disaster recovery. For production an account on AWS needs to be created.

Production vars should be set in Github Actions secrets.
