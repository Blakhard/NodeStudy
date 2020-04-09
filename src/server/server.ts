import http from 'http';

import { AllowedIPs, FileInit } from '../lib/interfaces';
import { EMIT_TYPES } from '../lib/utils';

import { requestListener, writeListener, readListener }  from './listeners';

const serverInit = (allowedIps: AllowedIPs, fsInit: FileInit): http.Server => {

  const server = new http.Server();
  const reqHandler = requestListener(server, allowedIps);
  
  // On incoming reqs we have reqHandler witch will handle then
  // In case it fit all requirements FETCH_OR_WRIGHT_LOCAL action is dispatched
  // If it succesfully  sent on server then stop
  // Other case it writes to file and READ_LOCAL_AND_FETCH emits
  server.on('request', reqHandler);
  server.on(EMIT_TYPES.FETCH_OR_WRIGHT_LOCAL, writeListener(fsInit.fd, server));
  server.on(EMIT_TYPES.READ_LOCAL_AND_FETCH, readListener(fsInit.fd, server));

  return server;
};



export default serverInit;
