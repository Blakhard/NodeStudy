import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

import { serverInit } from './server';
import { allowedList, EMIT_TYPES } from './lib/utils';
import { AllowedIPs, FileInit } from './lib/interfaces';
import { errLogger, logger } from './lib/utils';


const fileInit = (): FileInit => {

  const data = {} as FileInit;

  if (fs.existsSync(process.env.SAVE_FILE_NAME!)) {
    try {
      const messages = fs.readFileSync(process.env.SAVE_FILE_NAME!, { encoding: 'utf-8' });
      fs.truncateSync(process.env.SAVE_FILE_NAME!);
      const jsonString = messages.length > 0 ? 
        '[' + messages.split('}').filter(s => Boolean(s)).join('},') + '}]' :
        '[]';
      data.currentData = JSON.parse(jsonString);
    } catch (err) {
      errLogger(`We lost some data cause of ${err}`);
    }
  }
  data.fd = fs.openSync(process.env.SAVE_FILE_NAME!, 'a+');
  return data;
};

const init = async (): Promise<void> => {
  // Here resolve allowed IPs list for immediate closing connection for unsupported ips.
  // this take time but, think will help to filter some spam
  // Request can be change for anything: config, request to service, process params 
  // but if you don't want just use false
  const allowedIps: AllowedIPs | false = await Promise.resolve(allowedList);
  logger(`Got AllowedIPs`);
  // Also here we initialize our local log file for saving any hold messages
  logger('Initialize FS');
  const fsInit = fileInit();
  logger('FS Ready');

  const server = serverInit(allowedIps, fsInit);
  server.listen(parseInt(process.env.APP_PORT || '3000'), process.env.HOSTNAME, () => {
    logger(`Start server on ${process.env.APP_PORT}`);
  });

  // if we have some saved data we emit it to saveListener to work on it
  const { currentData } = fsInit;
  if (currentData && Array.isArray(currentData) && currentData.length > 0) {
    server.emit(EMIT_TYPES.FETCH_OR_WRIGHT_LOCAL, currentData);
  } 
};

init();