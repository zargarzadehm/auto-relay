import { startRelay } from "./relay.js";
import { startListener } from "./listener.js"
import { startDialer } from "./dialer.js"
import { delay, getOpenStream, sendMessage } from "./utils";

const main =  async () => {
    if (process.env.TYPE_P2P === "listener"){
        const node = await startListener().then( obj => {
            while(!obj.isStarted()){
                delay(5000)
            }
            return obj
        })
        await delay(20000)
        const peers = node.getPeers()
        for (let i =0; i <= 7; i++) {
            for await (const peer of peers){
                for (let i =0; i <= 7; i++) {
                    const connections = node.getConnections(peer)
                    const connAndStream = await getOpenStream(connections, node, peer)
                    const messageToSend = {
                        msg: {
                            Im: `${node.peerId.toString()}`,
                            youAre: `${peer.toString()}`
                        }
                    }
                    await sendMessage(connAndStream.stream, messageToSend, node.peerId.toString())

                }
            }
        }
    }

    else if (process.env.TYPE_P2P === "dialer") startDialer()
    else
        startRelay()
}

main()
