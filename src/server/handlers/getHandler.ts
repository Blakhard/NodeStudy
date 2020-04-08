import http from 'http';
import url from 'url';

import { Message } from '../../lib/interfaces';
import { badRequest } from '../utils';
import { EMIT_TYPES } from '../../lib/utils';

const getHandler =
(server: http.Server, saveData: Partial<Message>, req: http.IncomingMessage, res: http.ServerResponse): void => {
  const toSave = { ...saveData };
  const { query } = url.parse(req.url!, true);

  if (query.message && !Array.isArray(query.message)) {
    toSave.message = query.message;
  } else badRequest(res);

  server.emit(EMIT_TYPES.FETCH_OR_WRIGHT_LOCAL, [toSave]);
  res.statusCode = 200;
  res.end('OK');
  // TODO check if needed
  res.connection.end();
};

export default getHandler;