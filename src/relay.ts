import { createLibp2p, Libp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { getOrCreatePeerID, savePeerIdIfNeed } from "./utils.js";

let _NODE: Libp2p | undefined;

async function startRelay () {
    const peerId = await getOrCreatePeerID('relay')
    const node = await createLibp2p({
        peerId: peerId.peerId,
        addresses: {
            listen: ['/ip4/0.0.0.0/tcp/0/ws']
            // TODO check "What is next?" section
            // announce: ['/dns4/auto-relay.libp2p.io/tcp/443/wss/p2p/QmWDn2LY8nannvSWJzruUYoLZ4vV83vfCBwd8DipvdgQc3']
        },
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
            hop: {
                enabled: true
            },
            advertise: {
                enabled: true,
            }
        }
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
    _NODE = await node

    await savePeerIdIfNeed(peerId, 'relay')

    console.log(`Node started with id ${node.peerId.toString()}`)
    console.log('Listening on:')
    node.getMultiaddrs().forEach((ma) => console.log(ma.toString()))
}

export { startRelay }
