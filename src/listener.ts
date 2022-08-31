import { createLibp2p, Libp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { Bootstrap } from '@libp2p/bootstrap'
import { PubSubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { FloodSub } from '@libp2p/floodsub'
import { getOrCreatePeerID, savePeerIdIfNeed } from "./utils.js";
import { createFromJSON } from "@libp2p/peer-id-factory";
import { Multiaddr } from "@multiformats/multiaddr";

let _NODE: Libp2p | undefined;

async function startListener() {
    const peerId = await getOrCreatePeerID('listener')
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
        ],
        relay: {
            enabled: true,
            autoRelay: {
                enabled: true,
                maxListeners: 5
            }
        },
        pubsub: new FloodSub(),
        peerDiscovery: [
            new Bootstrap({
                interval: 10e3,
                list: [
                    '/ip4/10.10.9.6/tcp/8080/ws/p2p/12D3KooWHE8KRED4QroNj4UwPFfyHHysRjMRr3YE1HmFYKGfqo7x',
                    '/ip4/10.10.9.6/tcp/8081/ws/p2p/12D3KooWS9qp4rjviahzmLiBZjHA5LfwqgucrSKPvECkY764yGnb'
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
    _NODE = await node
    await savePeerIdIfNeed(peerId, 'listener')

    console.log(`Listener node started with id ${node.peerId.toString()}`)

    // Wait for connection and relay to be bind for the example purpose
    node.peerStore.addEventListener('change:multiaddrs', (evt) => {
        const {peerId} = evt.detail

        // Updated self multiaddrs?
        if (peerId.equals(node.peerId)) {
            console.log(`Advertising with a relay address of ${node.getMultiaddrs()[0].toString()}`)
        }
    })
    // addPeer().then(() => setTimeout(addPeer, 20 * 1000))

}

// async function addPeer() {
//     for (const peer of Array( "12D3KooWEthJsbikfajTQPercM1jwLcm1rSCrpGrhxrAF7CjbS1g", "12D3KooWChTtwD1yUXUEcLbE7ajYZLMcG4mgBTwBTFa9avbBxn2F", "12D3KooWLcw4KsdttzPmXiTiCxJVJ5KiTrZpXZeN8qBSVTLJ3g4s")) {
//         const multi = await new Multiaddr(`/ip4/10.10.9.6/tcp/45663/ws/p2p/12D3KooWHE8KRED4QroNj4UwPFfyHHysRjMRr3YE1HmFYKGfqo7x/p2p-circuit/p2p/${peer}`)
//         if(_NODE){
//             await _NODE.peerStore.addressBook.set(
//                 await createFromJSON({id: `${peer}`}),
//                 [multi]
//             )
//             const conn = await _NODE.dial(multi)
//             console.log(conn.remoteAddr.toString())
//         }
//     }
// }

export { startListener }
