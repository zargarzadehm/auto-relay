import { PeerId } from '@libp2p/interface-peer-id';
import { createEd25519PeerId, createFromJSON } from '@libp2p/peer-id-factory';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import fs from 'fs';
import { pipe } from 'it-pipe';
import { Stream } from '@libp2p/interface-connection';
import map from 'it-map';
import * as lp from 'it-length-prefixed';

/**
 * return PeerID or create PeerID if it doesn't exist
 * @return PeerID
 */
const getOrCreatePeerID = async (
  type: string,
  directoryName: string
): Promise<{ peerId: PeerId; exist: boolean }> => {
  if (
    !fs.existsSync(
      `./${directoryName}/${type}-${process.env.PEER_PATH_NUMBER!}.json`
    )
  ) {
    return {
      peerId: await createEd25519PeerId(),
      exist: false,
    } as const;
  } else {
    const jsonData: string = fs.readFileSync(
      `./${directoryName}/${type}-${process.env.PEER_PATH_NUMBER!}.json`,
      'utf8'
    );
    const peerIdDialerJson = await JSON.parse(jsonData);
    return {
      peerId: await createFromJSON(peerIdDialerJson),
      exist: true,
    };
  }
};

/**
 * If it didn't exist PeerID file, this function try to create a file and save peerId into that
 * @param peerObj { peerId: PeerId; exist: boolean }
 * @param type
 */
const savePeerIdIfNeed = async (
  peerObj: { peerId: PeerId; exist: boolean },
  type: string,
  directoryName: string
): Promise<void> => {
  if (!peerObj.exist) {
    const peerId = peerObj.peerId;
    let privateKey: Uint8Array;
    let publicKey: Uint8Array;
    if (peerId.privateKey && peerId.publicKey) {
      privateKey = peerId.privateKey;
      publicKey = peerId.publicKey;
    } else throw Error('PrivateKey for p2p is required');

    const peerIdDialerJson = {
      id: peerId.toString(),
      privKey: uint8ArrayToString(privateKey, 'base64pad'),
      pubKey: uint8ArrayToString(publicKey, 'base64pad'),
    };
    const jsonData = JSON.stringify(peerIdDialerJson);
    if (!fs.existsSync(directoryName)) {
      fs.mkdir(directoryName, function (err) {
        if (err) throw err;
        console.log('Directory created successfully');
      });
    }
    fs.writeFile(
      `./${directoryName}/${type}-${process.env.PEER_PATH_NUMBER!}.json`,
      jsonData,
      'utf8',
      function (err) {
        if (err) throw err;
        console.log('PeerId created!');
      }
    );
  }
};

const streamToConsole = async (stream: Stream) => {
  await pipe(
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
        console.log('> ' + msg.toString());
      }
    }
  );
};

export { savePeerIdIfNeed, getOrCreatePeerID, streamToConsole };
