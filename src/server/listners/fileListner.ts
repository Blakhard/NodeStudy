import fetch from 'node-fetch';
import http from 'http';
import fs from 'fs';
import { Message } from "../../lib/interfaces";

import { errLogger, EMIT_TYPES } from '../../lib/utils';

//There are 3 blokers 
// FILE_READING used to confirm that nothing will be added to the file while Reader class working
let FILE_READING = false;
// RECONECTION_TIMEOUT is used to reducer the reconections (depends on task how to set)
let RECONECTION_TIMEOUT = 1;
// TRY_TO_SAVE_FROM_FILE blocker for Reader class to remove unnedde actions
let TRY_TO_SAVE_FROM_FILE = false;

const errCheck = (err: Error | null): boolean => {
  if (err) {
    errLogger(err.message);
    return true;
  }
  return false;
};

const updateReconectionTimeout = (): void => {
  const maxTimeout = Number(process.env.RECONECTION_MAX_TIMEOUT);
  RECONECTION_TIMEOUT = RECONECTION_TIMEOUT < maxTimeout ? 
    RECONECTION_TIMEOUT + 1 : 
    maxTimeout;
};

class Reader {

  fetchSaveFromFile = async (message: Message[], server: http.Server, fd: number): Promise<void> => {
    const timeout = 1000 * RECONECTION_TIMEOUT;
    try {
      const response = await fetch(process.env.BACKEND_HOST!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        errLogger(`Backend service accesible on ${new Date()}, but have issues with saving data.`);
        updateReconectionTimeout();
        FILE_READING = false;
        setTimeout(() => this.read(server, fd)(), timeout);
      } else {
        fs.ftruncate(fd, (err) => {
          if (errCheck(err)) return;
          TRY_TO_SAVE_FROM_FILE = false;
          FILE_READING = false;
          RECONECTION_TIMEOUT = 1;
        });
      }
    } catch (error) {
      errLogger(`Backend service unaccesible on ${new Date()}`);
      updateReconectionTimeout();
      FILE_READING = false;
      setTimeout(() => this.read(server, fd)(), timeout);
    }
  };

  read = (server: http.Server, fd: number) => async (): Promise<void> => {
    if (FILE_READING) return;
    TRY_TO_SAVE_FROM_FILE = true;
    FILE_READING = true;
    fs.fstat(fd, (err, stat) => {
      if (errCheck(err)) return;

      const buffer = Buffer.alloc(stat.size);
      fs.read(fd, buffer, 0, stat.size, 0, (err) => {
        if (errCheck(err)) return;
        try {
          const data = buffer.toString('utf8');
          const jsonString = data.length > 0 ? '[' + data.split('}').filter(s => Boolean(s)).join('},') + '}]' : '[]';
          const messages = JSON.parse(jsonString);
          if (messages.length > 0) {
            this.fetchSaveFromFile(messages, server, fd);
          }
        } catch (error) {
          errLogger('Failed to parse JSON: ' + String(error));
        }
      });
    });
    
  };
}

class Writer {
  write = async (fd: number, message: Message[], server: http.Server): Promise<void> => {
    const timeout = 1000 * RECONECTION_TIMEOUT;
    if (!FILE_READING) {
      let toSave = '';
      message.forEach(m => toSave = toSave + JSON.stringify(m));
      fs.appendFile(fd, toSave, { encoding: 'utf8' }, (err) => {
        if (err) {
          errLogger(`Fail to wright to file cause of ${err}`);
          return;
        }
        server.emit(EMIT_TYPES.READ_LOCAL_AND_FETCH);
      });
    } else {
      setTimeout(() => this.write(fd, message, server), timeout);
    }
  };
  fetcher = async (message: Message[], fd: number, server: http.Server): Promise<void> => {
    try {
      const response = await fetch(process.env.BACKEND_HOST!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        errLogger(`Backend service accesible on ${new Date()}, but have issues with saving data.`);
        updateReconectionTimeout();
        this.write(fd, message, server);
      } else {
        RECONECTION_TIMEOUT = 1;
      }
    } catch (error) {
      errLogger(`Backend service unaccesible on ${new Date()}`);
      updateReconectionTimeout();
      this.write(fd, message, server);
    }
  };
}
const writer = new Writer();
const reader = new Reader();

const writeListner = (fd: number, server: http.Server) => (message: Message[]): void => {
  writer.fetcher(message, fd, server);
};
const readListner = (fd: number, server: http.Server) => (): void => {
  if (!TRY_TO_SAVE_FROM_FILE) {
    reader.read(server, fd)();
  }
};

export { writeListner, readListner };
