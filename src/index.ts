import { startRelay } from './relay.js';

const main = async () => {
  try {
    await startRelay();
  } catch (error) {
    console.error(`an error occurred for start relay: [${error}]`);
  }
};

main();
