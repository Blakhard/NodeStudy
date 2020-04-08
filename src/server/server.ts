import http from 'http';

import { AllowedIPs, FileInit } from '../lib/interfaces';
import { EMIT_TYPES } from '../lib/utils';

import { requestListner, writeListner, readListner }  from './listners';

const serverInit = (allowedIps: AllowedIPs, fsInit: FileInit): http.Server => {

  const server = new http.Server();
  const reqHandler = requestListner(server, allowedIps);
  
  server.on('request', reqHandler);
  server.on(EMIT_TYPES.FETCH_OR_WRIGHT_LOCAL, writeListner(fsInit.fd, server));
  server.on(EMIT_TYPES.READ_LOCAL_AND_FETCH, readListner(fsInit.fd, server));

  return server;
};



export default serverInit;
