# Waku Web Chat Example

This is just a POC to showcase Waku usage from the browser.

Shamelessly based on https://github.com/libp2p/js-libp2p-examples/

## Install

``` sh
(cd browser && npm install)
(cd nodejs && npm install)
```

## Run

Run bootstrap node:

``` sh
cd nodejs/bootstrap
node index.js
```

Run nodejs node:

``` sh
cd nodejs/src
node index.js
```


Run browser node:

``` sh
cd nodejs
npm start 
```

You may start multiple browser or nodejs nodes but only one bootstrap node.

## Patches

See patches folder for current hacks to get basic interop with nim-waku.

If there are problems applying them, comment out `postinstall` in
`package.json`.
