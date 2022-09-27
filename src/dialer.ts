import { createLibp2p, Libp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { Multiaddr } from '@multiformats/multiaddr'
import { getOrCreatePeerID, savePeerIdIfNeed } from "./utils.js";

let _NODE: Libp2p | undefined;

async function startDialer() {
    const autoRelayNodeAddr = process.env.AUTO_RELAY
    if (!autoRelayNodeAddr) {
        throw new Error('the auto relay node address needs to be specified')
    }
    const peerId = await getOrCreatePeerID('dialer')
    const node = await createLibp2p({
        peerId: peerId.peerId,
        transports: [
            new WebSockets()
        ],
        connectionEncryption: [
            new Noise()
        ],
        streamMuxers: [
            new Mplex()
        ]
    })

    await node.start()
    _NODE = await node
    await savePeerIdIfNeed(peerId, 'dialer')
    console.log(`Dialer node started with id ${node.peerId.toString()}`)

    const conn = await node.dial(await new Multiaddr(autoRelayNodeAddr))
    console.log(`Connected to the auto relay node via ${conn.remoteAddr.toString()}`)

    return _NODE
}

export { startDialer }
