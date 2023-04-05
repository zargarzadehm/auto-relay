import { createLibp2p, Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import * as multiaddr from '@multiformats/multiaddr';
import { getOrCreatePeerID, savePeerIdIfNeed } from './utils.js';

let _NODE: Libp2p | undefined;

async function startDialer() {
  const autoRelayNodeAddr = process.env.AUTO_RELAY;
  if (!autoRelayNodeAddr) {
    throw new Error('the auto relay node address needs to be specified');
  }
  const peerId = await getOrCreatePeerID('dialer');
  const node = await createLibp2p({
    peerId: peerId.peerId,
    transports: [webSockets()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
  });

  await node.start();
  _NODE = await node;
  await savePeerIdIfNeed(peerId, 'dialer');
  console.log(`Dialer node started with id ${node.peerId.toString()}`);

  const conn = await node.dial(multiaddr.multiaddr(autoRelayNodeAddr));
  console.log(
    `Connected to the auto relay node via ${conn.remoteAddr.toString()}`
  );

  return _NODE;
}

export { startDialer };
