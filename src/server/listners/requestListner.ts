import http from 'http';

import { AllowedIPs } from '../../lib/interfaces';
import { postHandler, getHandler } from '../handlers';
import { checkOptions, checker } from '../utils';

const requestHandler = 
(server: http.Server, allowedIps: AllowedIPs | false) => 
(req: http.IncomingMessage, res: http.ServerResponse): void => {
  const options = checkOptions(allowedIps, req, res);
  if (options) {
    return;
  }
  
  const toSave = checker(allowedIps, req, res);
  if (!toSave) return;
  // looks like there should be some devOps to set right Date in other case, date will be the local
  // Node date based on server machine time (which can be any).
  toSave.timestamp = Date.now();
  
  if (req.method === 'GET') {
    getHandler(server, toSave, req, res);
  } else {
    // previously we check that method can be only get or post
    postHandler(server, toSave, req, res);
  } 
};

export default requestHandler;
