import { startRelay } from "./relay.js";
import { startListener } from "./listener"
import { startDialer } from "./dialer"

if (process.env.TYPE_P2P === "listener")
    startListener()
else if (process.env.TYPE_P2P === "dialer")
    startDialer()
else
    startRelay()
