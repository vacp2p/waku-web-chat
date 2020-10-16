const protons = require('protons')

const { Request, Stats, WakuMessage } = protons(`
message WakuMessage {
  optional bytes payload = 1;
  optional string contentTopic = 2;
  optional string version = 3;
}

message Request {
  enum Type {
    SEND_MESSAGE = 0;
    UPDATE_PEER = 1;
    STATS = 2;
  }

  required Type type = 1;
  optional SendMessage sendMessage = 2;
  optional UpdatePeer updatePeer = 3;
  optional Stats stats = 4;
}

message SendMessage {
  required bytes data = 1;
  required int64 created = 2;
  required bytes id = 3;
}

message UpdatePeer {
  optional bytes userHandle = 1;
}

message Stats {
  enum NodeType {
    GO = 0;
    NODEJS = 1;
    BROWSER = 2;
  }

  repeated bytes connectedPeers = 1;
  optional NodeType nodeType = 2;
}
`)

class Chat {
  /**
   *
   * @param {Libp2p} libp2p A Libp2p node to communicate through
   * @param {string} topic The topic to subscribe to
   * @param {function(Message)} messageHandler Called with every `Message` received on `topic`
   */
  constructor(libp2p, topic, messageHandler) {
    this.libp2p = libp2p
    this.topic = topic
    this.messageHandler = messageHandler
    this.userHandles = new Map([
      [libp2p.peerId.toB58String(), 'Me']
    ])

    this.connectedPeers = new Set()
    this.libp2p.connectionManager.on('peer:connect', (connection) => {
      if (this.connectedPeers.has(connection.remotePeer.toB58String())) return
      this.connectedPeers.add(connection.remotePeer.toB58String())
      this.sendStats(Array.from(this.connectedPeers))
    })
    this.libp2p.connectionManager.on('peer:disconnect', (connection) => {
      if (this.connectedPeers.delete(connection.remotePeer.toB58String())) {
        this.sendStats(Array.from(this.connectedPeers))
      }
    })

    // Join if libp2p is already on
    if (this.libp2p.isStarted()) this.join()

    // Experimental feature flag for WIP WakuMessage usage.
    //
    // If this flag is enabled:
    // - This impl is according to spec
    // - Messages are published and subscribed on as WakuMessage
    // - Messages published here show up on nim-waku in clear text
    // - Messages published on nim-waku for some reason don't show up here yet
    // - No other Requests works, such as Stats etc
    // - No interop with browser yet
    //
    // If it isn't enabled:
    // - Largely inverse of above, notably not according to spec
    // - No real interop with nim-waku
    // - On flip side, nice UI with browser and Stats/Nick etc
    this.useWakuMessage = false

    console.info("Using WakuMessage?", this.useWakuMessage)

  }

  /**
   * Handler that is run when `this.libp2p` starts
   */
  onStart () {
    this.join()
  }

  /**
   * Handler that is run when `this.libp2p` stops
   */
  onStop () {
    this.leave()
  }

  /**
   * Subscribes to `Chat.topic`. All messages will be
   * forwarded to `messageHandler`
   * @private
   */
  join () {
    this.libp2p.pubsub.subscribe(this.topic, (message) => {
      try {
        console.info("Received message on topic, trying to decode...")
        if (this.useWakuMessage) {
          console.info("Reading message as a WakuMessage")
          const msg = WakuMessage.decode(message.data)
          // XXX: Might not always work...
          const text = String.fromCharCode(...msg.payload)
          console.info("WakuMessage: ", msg.contentTopic, text)
        }
        else {
          //TODO Figure out how to re-enable / remove wrt chat2 example
          console.info("Reading message as a Request")
          const request = Request.decode(message.data)
          switch (request.type) {
          case Request.Type.UPDATE_PEER:
            const newHandle = request.updatePeer.userHandle.toString()
            console.info(`System: ${message.from} is now ${newHandle}.`)
            this.userHandles.set(message.from, newHandle)
            break
          case Request.Type.SEND_MESSAGE:
            this.messageHandler({
              from: message.from,
              message: request.sendMessage
            })
            break
          default:
            // Do nothing
          }
        }

      } catch (err) {
        console.error(err)
      }
    })
  }

  /**
   * Unsubscribes from `Chat.topic`
   * @private
   */
  leave () {
    this.libp2p.pubsub.unsubscribe(this.topic)
  }

  /**
   * Crudely checks the input for a command. If no command is
   * found `false` is returned. If the input contains a command,
   * that command will be processed and `true` will be returned.
   * @param {Buffer|string} input Text submitted by the user
   * @returns {boolean} Whether or not there was a command
   */
  checkCommand (input) {
    const str = input.toString()
    if (str.startsWith('/')) {
      const args = str.slice(1).split(' ')
      switch (args[0]) {
        case 'name':
          this.updatePeer(args[1])
          return true
      }
    }
    return false
  }

  // TODO Update these to use WakuMessage

  /**
   * Sends a message over pubsub to update the user handle
   * to the provided `name`.
   * @param {Buffer|string} name Username to change to
   */
  async updatePeer (name) {
    const msg = Request.encode({
      type: Request.Type.UPDATE_PEER,
      updatePeer: {
        userHandle: Buffer.from(name)
      }
    })

    try {
      await this.libp2p.pubsub.publish(this.topic, msg)
    } catch (err) {
      console.error('Could not publish name change', err)
    }
  }

  /**
   * Sends the updated stats to the pubsub network
   * @param {Array<Buffer>} connectedPeers
   */
  async sendStats (connectedPeers) {
    const msg = Request.encode({
      type: Request.Type.STATS,
      stats: {
        connectedPeers,
        nodeType: Stats.NodeType.NODEJS
      }
    })

    try {
      await this.libp2p.pubsub.publish(this.topic, msg)
    } catch (err) {
      console.error('Could not publish stats update', err)
    }
  }

  /**
   * Publishes the given `message` to pubsub peers
   * @throws
   * @param {Buffer|string} message The chat message to send
   */
  async send (message) {
    var msg
    // NOTE Conditionally wrap in WakuMessage or not
    if (this.useWakuMessage) {
      msg = WakuMessage.encode({
        contentTopic: 'dingpu',
        payload: Buffer.from(message)
      })
    }
    else {
      msg = Request.encode({
        type: Request.Type.SEND_MESSAGE,
        sendMessage: {
          id: (~~(Math.random() * 1e9)).toString(36) + Date.now(),
          data: Buffer.from(message),
          created: Date.now()
        }
      })
    }
    await this.libp2p.pubsub.publish(this.topic, msg)
  }
}

module.exports = Chat
module.exports.TOPIC = 'waku'
module.exports.CLEARLINE = '\033[1A'
