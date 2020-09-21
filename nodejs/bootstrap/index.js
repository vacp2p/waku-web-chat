'use strict'

// Libp2p Core
const Libp2p = require('libp2p')
// Transports
const TCP = require('libp2p-tcp')
const Websockets = require('libp2p-websockets')
const WebrtcStar = require('libp2p-webrtc-star')
// wrtc for node to supplement WebrtcStar
const wrtc = require('wrtc')
// Signaling Server for webrtc
const SignalingServer = require('libp2p-webrtc-star/src/sig-server')

// Stream Multiplexers
const Mplex = require('libp2p-mplex')
// Encryption
const { NOISE } = require('libp2p-noise')
const Secio = require('libp2p-secio')
// Discovery
const MDNS = require('libp2p-mdns')
// DHT
const KademliaDHT = require('libp2p-kad-dht')
// PubSub
const Gossipsub = require('libp2p-gossipsub')

const PeerId = require('peer-id')
const idJSON = require('../id.json')

;(async () => {
  const peerId = await PeerId.createFromJSON(idJSON)

  // Wildcard listen on TCP and Websocket
  const addrs = [
    '/ip4/0.0.0.0/tcp/63785',
    '/ip4/0.0.0.0/tcp/63786/ws'
  ]

  const signalingServer = await SignalingServer.start({
    port: 15555
  })
  const ssAddr = `/ip4/${signalingServer.info.host}/tcp/${signalingServer.info.port}/ws/p2p-webrtc-star`
  console.info(`Signaling server running at ${ssAddr}`)
  addrs.push(`${ssAddr}/p2p/${peerId.toB58String()}`)

  // Create the node
  const libp2p = await createBootstrapNode(peerId, addrs)

  // Start the node
  await libp2p.start()
  console.log('Node started with addresses:')
  libp2p.transportManager.getAddrs().forEach(ma => console.log(ma.toString()))
  console.log('\nNode supports protocols:')
  libp2p.upgrader.protocols.forEach((_, p) => console.log(p))

})()


const createBootstrapNode = (peerId, listenAddrs) => {
  return Libp2p.create({
    peerId,
    addresses: {
      listen: listenAddrs
    },
    modules: {
      transport: [ WebrtcStar, TCP, Websockets ],
      streamMuxer: [ Mplex ],
      connEncryption: [ NOISE, Secio ],
      peerDiscovery: [ MDNS ],
      dht: KademliaDHT
    },
    config: {
      transport : {
        [WebrtcStar.prototype[Symbol.toStringTag]]: {
          wrtc
        }
      },
      relay: {
        enabled: true,
        hop: {
          enabled: true,
          active: false
        }
      },
      dht: {
        enabled: true,
        randomWalk: {
          enabled: true
        }
      }
    }
  })
}
