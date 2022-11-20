import { createLibp2p, Libp2p, Libp2pInit } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { bootstrap } from '@libp2p/bootstrap'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { getOrCreatePeerID, savePeerIdIfNeed, streamToConsole } from "./utils.js";


/**
 * TODO: This is needed because of an issue in types of `@libp2p/pubsub-peer-discovery`
 * which mismatch with types of `libp2p`
 */
 type PeerDiscoveryArray = Libp2pInit['peerDiscovery'];
 type PeerDiscovery = PeerDiscoveryArray extends
    | readonly (infer ElementType)[]
    | undefined
    ? ElementType
    : never;

let _NODE: Libp2p | undefined;

async function startListener() {
    const peerId = await getOrCreatePeerID('listener')
    const node = await createLibp2p({
        peerId: peerId.peerId,
        transports: [
            webSockets()
        ],
        connectionEncryption: [
            noise()
        ],
        streamMuxers: [
            mplex()
        ],
        relay: {
            enabled: true,
            autoRelay: {
                enabled: true,
                maxListeners: 5
            }
        },
        pubsub: gossipsub({ allowPublishToZeroPeers: true }),
        peerDiscovery: [
            bootstrap({
                timeout: 10e3,
                list: [
                    '/ip4/10.10.9.6/tcp/8080/ws/p2p/12D3KooWHE8KRED4QroNj4UwPFfyHHysRjMRr3YE1HmFYKGfqo7x',
                    '/ip4/10.10.9.6/tcp/8081/ws/p2p/12D3KooWS9qp4rjviahzmLiBZjHA5LfwqgucrSKPvECkY764yGnb'
                ]
            }),
            pubsubPeerDiscovery({
                interval: 1000
            }) as PeerDiscovery
        ]
    })

    // Listen for new peers
    node.addEventListener('peer:discovery', (evt) => {
        console.log(`Peer ${node.peerId.toString()} discovered: ${evt.detail.id.toString()} with ${evt.detail.multiaddrs}`)
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
    _NODE = await node
    await savePeerIdIfNeed(peerId, 'listener')

    console.log(`Listener node started with id ${node.peerId.toString()}`)

    // Handle messages for the protocol
    await node.handle(
        '/broadcast',
        async ({stream}) => {
            // Read the stream and output to console
            streamToConsole(stream)
        }
    )

    // Wait for connection and relay to be bind for the example purpose
    node.peerStore.addEventListener('change:multiaddrs', (evt) => {
        const { peerId } = evt.detail

        // Updated self multiaddrs?
        if (peerId.equals(node.peerId)) {
            console.log(`Advertising with a relay address of ${node.getMultiaddrs()[0].toString()}`)
        }
    })
    return node
}

export { startListener }
