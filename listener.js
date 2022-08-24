import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { Bootstrap } from '@libp2p/bootstrap'
import { PubSubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'

async function main () {
  const relayAddr = process.argv[2]
  if (!relayAddr) {
    throw new Error('the relay address needs to be specified as a parameter')
  }

  const node = await createLibp2p({
    transports: [
      new WebSockets()
    ],
    connectionEncryption: [
      new Noise()
    ],
    streamMuxers: [
      new Mplex()
    ],
    relay: {
      enabled: true,
      autoRelay: {
        enabled: true,
        maxListeners: 2
      }
    },
    peerDiscovery: [
      new Bootstrap({
        interval: 60e3,
        list: [
          '/ip4/127.0.0.1/tcp/8000/ws/p2p/Qma3GsJmB47xYuyahPZPSadh1avvxfyYQwk8R3UnFrQ6aP'
        ]
      }),
      new PubSubPeerDiscovery({
        interval: 1000
      })
    ]
  })

  // Listen for new peers
  node.addEventListener('peer:discovery', (evt) => {
    console.log(`Found peer ${evt.detail.id.toString()}`)
  })

  // Listen for new connections to peers
  node.connectionManager.addEventListener('peer:connect', (evt) => {
    console.log(`Connected to ${evt.detail.remotePeer.toString()}`)
  })

  // Listen for peers disconnecting
  node.connectionManager.addEventListener('peer:disconnect', (evt) => {
    console.log(`Disconnected from ${evt.detail.remotePeer.toString()}`)
  })

  await node.start()
  console.log(`Node started with id ${node.peerId.toString()}`)

  const conn = await node.dial(relayAddr)

  console.log(`Connected to the HOP relay ${conn.remotePeer.toString()}`)

  // Wait for connection and relay to be bind for the example purpose
  node.peerStore.addEventListener('change:multiaddrs', (evt) => {
    const { peerId } = evt.detail

    // Updated self multiaddrs?
    if (peerId.equals(node.peerId)) {
      console.log(`Advertising with a relay address of ${node.getMultiaddrs()[0].toString()}`)
    }
  })
}

main()
