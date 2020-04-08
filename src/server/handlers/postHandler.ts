import http from 'http';


import { Message } from '../../lib/interfaces';
import { badRequest } from '../utils';
import { EMIT_TYPES, logger } from '../../lib/utils';

const postHandler = 
(server: http.Server, saveData: Partial<Message>, req: http.IncomingMessage, res: http.ServerResponse): void => {
  const toSave = { ...saveData };
  let dataBuffer = '';
    const readCallback = (): void => {
      dataBuffer += req.read() ?? '';
      if (dataBuffer.length > parseInt(process.env.MAX_MESSAGE_LEN!)) {
        res.statusCode = 413;
        res.end('Too big message');
        return;
      }
    };
    const endCallback = (): void => {
      try {
        const { message } = JSON.parse(dataBuffer);
        if (!message) badRequest(res);
        toSave.message = message;

        server.emit(EMIT_TYPES.FETCH_OR_WRIGHT_LOCAL, [toSave]);
        res.statusCode = 200;
        res.end('OK');
        res.connection.end();
      } catch (err) {
        logger('LOG' + err);
        badRequest(res); 
      }
    };
    req.on('readable', readCallback);
    req.on('end', endCallback);
};

export default postHandler;