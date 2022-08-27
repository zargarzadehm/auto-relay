import { startRelay } from "./relay.js";
import { startListener } from "./listener.js"
import { startDialer } from "./dialer.js"

if (process.env.TYPE_P2P === "listener")
    startListener()
else if (process.env.TYPE_P2P === "dialer")
    startDialer()
else
    startRelay()
