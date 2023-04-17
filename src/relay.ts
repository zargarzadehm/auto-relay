import { createLibp2p, Libp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import {
  getOrCreatePeerID,
  savePeerIdIfNeed,
  streamToConsole,
} from './utils.js';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { PassThrough } from 'stream';

let _NODE: Libp2p | undefined;
const _OUTPUT_STREAMS: Map<string, PassThrough> = new Map<
  string,
  PassThrough
>();
const _SUPPORTED_PROTOCOL = '/getpeers';

async function startRelay() {
  const peerId = await getOrCreatePeerID('relay');
  const node = await createLibp2p({
    peerId: peerId.peerId,
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/808${process.env.PEER_PATH_NUMBER!}/ws`],
      // TODO check "What is next?" section
      // announce: ['/dns4/auto-relay.libp2p.io/tcp/443/wss/p2p/QmWDn2LY8nannvSWJzruUYoLZ4vV83vfCBwd8DipvdgQc3']
    },
    transports: [webSockets()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
    relay: {
      enabled: true,
      hop: {
        enabled: true,
        timeout: 600_000, // 10 minutes
      },
    },
    pubsub: gossipsub({ allowPublishToZeroPeers: true }),
    peerDiscovery: [
      pubsubPeerDiscovery({
        interval: 1000,
      }),
    ],
  });

  // Listen for new peers
  node.addEventListener('peer:discovery', (evt) => {
    console.log(`Found peer ${evt.detail.id.toString()}`);
  });

  // Listen for new connections to peers
  node.connectionManager.addEventListener('peer:connect', (evt) => {
    console.log(`Connected to ${evt.detail.remotePeer.toString()}`);
  });

  // Listen for peers disconnecting
  node.connectionManager.addEventListener('peer:disconnect', (evt) => {
    console.log(`Disconnected from ${evt.detail.remotePeer.toString()}`);
    _OUTPUT_STREAMS.forEach((value, key) => {
      if (key.includes(evt.detail.remotePeer.toString()))
        _OUTPUT_STREAMS.delete(key);
    });
  });

  // Handle messages for the protocol
  await node.handle('/broadcast', async ({ stream }) => {
    // Read the stream and output to console
    streamToConsole(stream);
  });

  // Handle messages for the protocol
  await node.handle(_SUPPORTED_PROTOCOL, async ({ stream }) => {
    // Read the stream and output to console
    streamToConsole(stream);
  });

  await node.start();
  _NODE = await node;

  await savePeerIdIfNeed(peerId, 'relay');

  console.log(`Relay node started with id ${node.peerId.toString()}`);
  console.log('Listening on:');
  node.getMultiaddrs().forEach((ma) => console.log(ma.toString()));

  /**
   * TODO: This is not the ideal way to increase the streams limits, but there
   * seems to be no other way to do it with current libp2p apis. It needs to
   * be changed if such an api is added in the future.
   *
   * Related issues:
   * - https://github.com/libp2p/js-libp2p/issues/1518
   * - https://git.ergopool.io/ergo/rosen-bridge/p2p/auto-relay/-/issues/17
   */
  const handler = node.registrar.getHandler('/libp2p/circuit/relay/0.1.0');
  node.registrar.unhandle('/libp2p/circuit/relay/0.1.0');
  await node.registrar.handle('/libp2p/circuit/relay/0.1.0', handler.handler, {
    ...handler.options,
    maxInboundStreams: 1000,
    maxOutboundStreams: 1000,
  });

  return _NODE;
}

export { startRelay };
