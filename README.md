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
cd browser
npm start 
```

It may take a while for the browser node to connect with the nodejs node.

You may start multiple browser or nodejs nodes but only one bootstrap node.

## Patches

See patches folder for current hacks to get basic interop with nim-waku.

If there are problems applying them, comment out `postinstall` in
`package.json`.

## Interop with nim-waku

Go to https://github.com/status-im/nim-waku/ and build `wakunode2`.

Then run it:

```
./build/wakunode2 --ports-shift:0
```

Note the "Listening on" address in logs. E.g. `/ip4/0.0.0.0/tcp/60000/p2p/16Uiu2HAmVKynP3QDpjxS2gujvy2Bp3BEKp8NzKmYspxDEVAGHftG`.

Call nodejs node with it as argument:

``` sh
node index.js /ip4/0.0.0.0/tcp/60000/p2p/16Uiu2HAmVKynP3QDpjxS2gujvy2Bp3BEKp8NzKmYspxDEVAGHftG
```

You should notice in the nim-waku logs that messages are getting through. However, the protobuf isn't parsed.

The WakuMessage wrapper is also missing, meaning this current implementation is
not according to spec.
