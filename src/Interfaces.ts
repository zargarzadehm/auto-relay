import { Connection, Stream } from '@libp2p/interface-connection';

interface SendDataCommunication {
  peerIds: string[];
}

interface ConnectionStream {
  connection: Connection;
  stream: Stream;
}

export { SendDataCommunication, ConnectionStream };
