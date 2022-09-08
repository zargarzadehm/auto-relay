import { PeerId } from "@libp2p/interface-peer-id";
import { createEd25519PeerId, createFromJSON } from "@libp2p/peer-id-factory";
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import fs from "fs";
import { Libp2p } from "libp2p";
import { pipe } from "it-pipe";
import { JsonBI } from "./NetworkModels";
import { Connection, Stream } from "@libp2p/interface-connection";
import map from "it-map";
import * as lp from "it-length-prefixed";
import { OPEN }  from "@libp2p/interface-connection/status";

/**
 * return PeerID or create PeerID if it doesn't exist
 * @return PeerID
 */
const getOrCreatePeerID = async (type: string): Promise<{ peerId: PeerId; exist: boolean }> => {
    if (!fs.existsSync(`./${type}-${process.env.PEER_PATH_NUMBER!}.json`)) {
        return {
            peerId: await createEd25519PeerId(),
            exist: false
        } as const
    } else {
        const jsonData: string = fs.readFileSync(`./${type}-${process.env.PEER_PATH_NUMBER!}.json`, 'utf8')
        const peerIdDialerJson = await JSON.parse(jsonData)
        return {
            peerId: await createFromJSON(peerIdDialerJson),
            exist: true
        }
    }
}

/**
 * If it didn't exist PeerID file, this function try to create a file and save peerId into that
 * @param peerObj { peerId: PeerId; exist: boolean }
 * @param type
 */
const savePeerIdIfNeed = async (peerObj: { peerId: PeerId; exist: boolean }, type: string): Promise<void> => {
    if (!peerObj.exist) {
        const peerId = peerObj.peerId
        let privateKey: Uint8Array
        let publicKey: Uint8Array
        if (peerId.privateKey && peerId.publicKey) {
            privateKey = peerId.privateKey
            publicKey = peerId.publicKey
        } else throw Error("PrivateKey for p2p is required")

        const peerIdDialerJson = {
            "id": peerId.toString(),
            "privKey": uint8ArrayToString(privateKey, "base64pad"),
            "pubKey": uint8ArrayToString(publicKey, "base64pad"),
        }
        const jsonData = JSON.stringify(peerIdDialerJson)
        fs.writeFile(`./${type}-${process.env.PEER_PATH_NUMBER!}.json`, jsonData, 'utf8', function (err) {
            if (err) throw err;
            console.log('PeerId created!');
        })
    }
}

/**
 * Send message to a peer
 * @param stream
 * @param peer destination PeerId
 * @param msg a json data include (msg, channel, receiver(optional))
 * @param node create connection to peer
 * @param sender
 */
const sendMessage =  async (stream: Stream, msg: any, sender: string) => {
    msg.sender = sender

    await pipe(
        [await uint8ArrayFromString(JsonBI.stringify(msg))],
        // Encode with length prefix (so receiving side knows how much data is coming)
        lp.encode(),
        // Write to the stream (the sink)
        stream.sink
    )
    await stream.close()
}

const getOpenStream = async (connections: Array<Connection>, node: Libp2p, peer: PeerId): Promise<{ connection: Connection; stream: Stream }> => {
    let connection: Connection | undefined = undefined
    let stream: Stream | undefined = undefined
    for await (const conn of connections) {
        if(conn.stat.status === OPEN) {
            for await (const obj of conn.streams){
                if (obj.stat.protocol === "broadcast") {
                    stream = obj
                    break
                }
            }
            connection = conn
            if (stream) break
            else stream = await conn.newStream(['/broadcast'])
        }
        else await conn.close()
    }

    if (!connection) {
        connection = await node.dial(peer)
        stream = await connection.newStream(['/broadcast'])
    }
    if (!stream) stream = await connection.newStream(['/broadcast'])
    return {
        stream: stream,
        connection: connection
    }
}

function streamToConsole(stream: Stream) {
    pipe(
        // Read from the stream (the source)
        stream.source,
        // Decode length-prefixed data
        lp.decode(),
        // Turn buffers into strings
        (source) => map(source, (buf) => uint8ArrayToString(buf.subarray())),
        // Sink function
        async function (source) {
            // For each chunk of data
            for await (const msg of source) {
                // Output the data as a utf8 string
                console.log('> ' + msg.toString().replace('\n', ''))
            }
        }
    )
}

// /**
//  * Get message from peers and send according
//  * @param stream
//  * @param connection
//  * @param node
//  */
// const getMessageAndBroadCast = async (stream: Stream, connection: Connection, node: Libp2p): Promise<void> => {
//     try {
//         let receivedData: any = {}
//         // For each chunk of data
//         for await (const data of stream.source) {
//             // Output the data
//             receivedData = await JsonBI.parse(uint8ArrayToString(data.subarray()))
//         }
//
//         if(receivedData.receiver) {
//             const peer = await (node.getPeers()).find((obj) => {
//                 return (obj.toString() === receivedData.receiver);
//             })
//             if(peer) {
//                 await sendMessage(peer, receivedData, node, connection.remotePeer.toString())
//             }
//         }
//         else {
//             for await (const peer of node.getPeers()) {
//                 if (peer.toString() !== connection.remotePeer.toString())
//                     await sendMessage(peer, receivedData, node, connection.remotePeer.toString());
//             }
//         }
//     }
//     catch (e) {
//         console.log(e)
//     }
// }

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export { savePeerIdIfNeed, getOrCreatePeerID, delay, sendMessage, getOpenStream, streamToConsole }
