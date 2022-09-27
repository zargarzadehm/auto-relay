import { createLibp2p, Libp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { getOrCreatePeerID, savePeerIdIfNeed, streamToConsole } from "./utils.js";
import { FloodSub } from "@libp2p/floodsub";
import { PubSubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { ConnectionStream, SendDataCommunication } from "./Interfaces.js";
import { logger } from "./log/Logger.js";
import { PeerId } from "@libp2p/interface-peer-id";
import { PassThrough } from "stream";
import { pipe } from "it-pipe";
import * as lp from "it-length-prefixed";
import { JsonBI } from "./NetworkModels.js";
import { Connection, Stream } from "@libp2p/interface-connection";
import { OPEN } from '@libp2p/interface-connection/status';

let _NODE: Libp2p | undefined;
const _PENDING_MESSAGE: SendDataCommunication[] = [];
const _OUTPUT_STREAMS: Map<string, PassThrough> = new Map<string,
    PassThrough>();
const _SUPPORTED_PROTOCOL: string = '/get-peers';


async function startRelay() {
    const peerId = await getOrCreatePeerID('relay')
    const node = await createLibp2p({
        peerId: peerId.peerId,
        addresses: {
            listen: [`/ip4/0.0.0.0/tcp/808${process.env.PEER_PATH_NUMBER!}/ws`]
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
        },
        pubsub: new FloodSub(),
        peerDiscovery: [
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

    // Handle messages for the protocol
    await node.handle(
        '/broadcast',
        async ({stream}) => {
            // Read the stream and output to console
            streamToConsole(stream)
        }
    )

    // Handle messages for the protocol
    await node.handle(
        _SUPPORTED_PROTOCOL,
        async ({stream}) => {
            // Read the stream and output to console
            streamToConsole(stream)
        }
    )

    await node.start()
    _NODE = await node

    await savePeerIdIfNeed(peerId, 'relay')

    console.log(`Relay node started with id ${node.peerId.toString()}`)
    console.log('Listening on:')
    node.getMultiaddrs().forEach((ma) => console.log(ma.toString()))

    return _NODE
}


/**
 * create or find an open stream for specific peer and protocol
 * @param node
 * @param peer create or find stream for peer
 * @param protocol try to create a stream with this protocol
 */
const getOpenStream = async (
    node: Libp2p,
    peer: PeerId,
    protocol: string
): Promise<ConnectionStream> => {
    let connection: Connection | undefined = undefined;
    let stream: Stream | undefined = undefined;
    for await (const conn of node.getConnections(peer)) {
        if (conn.stat.status === OPEN) {
            for await (const obj of conn.streams) {
                if (obj.stat.protocol === protocol) {
                    stream = obj;
                    break;
                }
            }
            connection = conn;
            if (stream) break;
            else stream = await conn.newStream([protocol]);
        } else await conn.close();
    }
    if (!connection) {
        connection = await node.dial(peer);
        stream = await connection.newStream([protocol]);
    }
    if (!stream) stream = await connection.newStream([protocol]);
    return {
        stream: stream,
        connection: connection,
    };
};


/**
 * write data on stream for a peer
 * @param node
 * @param peer
 * @param messageToSend
 */
const streamForPeer = async (
    node: Libp2p,
    peer: PeerId,
    messageToSend: SendDataCommunication
): Promise<void> => {
    let outputStream: PassThrough | undefined;

    const connStream = await getOpenStream(
        node,
        peer,
        _SUPPORTED_PROTOCOL
    );
    const passThroughName = `${peer.toString()}-${_SUPPORTED_PROTOCOL}-${
        connStream.stream.id
    }`;

    if (_OUTPUT_STREAMS.has(passThroughName)) {
        outputStream = _OUTPUT_STREAMS.get(passThroughName);
    } else {
        const outStream = new PassThrough();
        _OUTPUT_STREAMS.set(passThroughName, outStream);
        outputStream = outStream;
        pipe(outputStream, lp.encode(), connStream.stream).catch((e) => {
            logger.error(e);
            connStream.stream.close();
            _OUTPUT_STREAMS.delete(passThroughName);
            _PENDING_MESSAGE.push(messageToSend);
            logger.warn(
                "Message added to pending list due to dialer node isn't ready"
            );
        });
    }

    if (outputStream) {
        // Give time for the stream to flush.
        await new Promise((resolve) =>
            setTimeout(resolve, 0.1 * 1000)
        );
        // Send some outgoing data.
        outputStream.write(JsonBI.stringify(messageToSend));
    } else {
        logger.error(`doesn't exist output pass through for ${passThroughName}`);
    }
};


/**
 * send list of peerIds to peers
 */
const broadcastPeerIds = async (): Promise<void> => {

    if (!_NODE) {
        logger.warn(
            "Dialer node isn't ready"
        );
        return;
    }

    // send message for listener peers (not relays)
    const peers = _NODE.getPeers();
    for (const peer of peers) {
        const data: SendDataCommunication = {
            peerIds: peers.map(p => p.toString()).filter(p => p !== peer.toString())
        };
        streamForPeer(_NODE, peer, data);
    }
};


export { startRelay, broadcastPeerIds }
