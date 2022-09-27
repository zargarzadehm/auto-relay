import { broadcastPeerIds, startRelay } from "./relay.js";
import { startListener } from "./listener.js"
import { startDialer } from "./dialer.js"
import { delay, getOpenStream, startSendingMessage } from "./utils.js";
import { JsonBI } from "./NetworkModels.js";
import { PassThrough } from "stream";

const outputStreams: Map<string, PassThrough> = new Map<string, PassThrough>()

const main = async () => {
    if (process.env.TYPE_P2P === "listener") {
        const node = await startListener().then(obj => {
            while (!obj.isStarted()) {
                delay(5000)
            }
            return obj
        })
        // TEST SCENARIO
        //       |||
        //       \/
        await delay(20000)
        const peers = node.getPeers()
        for (let i = 0; i < 7; i++) {
            let p = 0
            for await (const peer of peers) {
                console.log(`ronud is ${i} for ${p}`)
                const connections = node.getConnections(peer)
                const connAndStream = await getOpenStream(connections, node, peer)
                let outputStream: PassThrough | undefined = undefined
                const outputStreamName = `${peer.toString()}-/broadcast-${connAndStream.stream.id}`
                if (outputStreams.has(outputStreamName)) {
                    console.log("outputStreamName: ", outputStreamName)
                    outputStream = outputStreams.get(outputStreamName)
                } else {
                    const outStream = new PassThrough();
                    outputStreams.set(outputStreamName, outStream)
                    outputStream = outStream
                    console.log("started 1")
                    console.log(`stream id is: ${connAndStream.stream.id}`)
                    startSendingMessage(connAndStream.stream, outputStream)
                }
                for (let j = 0; j < 7; j++) {
                    console.log(`stream id is: ${connAndStream.stream.id}, ${j}`)
                    const messageToSend: any = {
                        msg: {
                            Im: `${node.peerId.toString()}`,
                            youAre: `${peer.toString()}`,
                            peer: `${p}`,
                            round: `${i}`
                        }
                    }
                    if (outputStream) {
                        messageToSend.sender = node.peerId.toString()
                        console.log("started 3")
                        await new Promise(resolve => setTimeout(resolve, 100));
                        console.log("started 4")
                        outputStream.write("First data");
                        await new Promise(resolve => setTimeout(resolve, 100));
                        outputStream.write("Second");
                        await new Promise(resolve => setTimeout(resolve, 100));
                        outputStream.write("Last");

                        for (let j = 0; j < 20; j++) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                            outputStream.write(JsonBI.stringify(messageToSend));
                            console.log(j)
                        }
                    }
                    else {console.log("doesn't exist outputStream: ", )}

                }
                p++
            }
        }
    } else if (process.env.TYPE_P2P === "dialer") startDialer()
    else{
        await startRelay().then(obj => {
            while (!obj.isStarted()) {
                delay(5000)
            }
            return obj
        })

        new Promise(() =>
            setInterval(
                broadcastPeerIds,
                30 * 1000
            )
        );
    }

}

main()
