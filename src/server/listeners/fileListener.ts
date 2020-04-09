import fetch from 'node-fetch';
import http from 'http';
import fs from 'fs';
import { Message } from "../../lib/interfaces";

import { errLogger, EMIT_TYPES } from '../../lib/utils';

//There are 3 blockers 
// FILE_READING used to confirm that nothing will be added to the file while Reader class working
let FILE_READING = false;
// RECONNECTION_TIMEOUT is used to reducer the reconnection attempts (depends on task how to set)
let RECONNECTION_TIMEOUT = 1;
// TRY_TO_SAVE_FROM_FILE blocker for Reader class to remove unneeded actions
let TRY_TO_SAVE_FROM_FILE = false;

const errCheck = (err: Error | null): boolean => {
  if (err) {
    errLogger(err.message);
    return true;
  }
  return false;
};

const updateReconnectionTimeout = (): void => {
  const maxTimeout = Number(process.env.RECONNECTION_MAX_TIMEOUT);
  RECONNECTION_TIMEOUT = RECONNECTION_TIMEOUT < maxTimeout ? 
    RECONNECTION_TIMEOUT + 1 : 
    maxTimeout;
};

class Reader {

  fetchSaveFromFile = async (message: Message[], server: http.Server, fd: number): Promise<void> => {
    const timeout = 1000 * RECONNECTION_TIMEOUT;
    try {
      const response = await fetch(process.env.BACKEND_HOST!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        errLogger(`Backend service accessible on ${new Date()}, but have issues with saving data.`);
        updateReconnectionTimeout();
        FILE_READING = false;
        setTimeout(() => this.read(server, fd)(), timeout);
      } else {
        fs.ftruncate(fd, (err) => {
          if (errCheck(err)) return;
          TRY_TO_SAVE_FROM_FILE = false;
          FILE_READING = false;
          RECONNECTION_TIMEOUT = 1;
        });
      }
    } catch (error) {
      errLogger(`Backend service unaccessible on ${new Date()}`);
      updateReconnectionTimeout();
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
    const timeout = 1000 * RECONNECTION_TIMEOUT;
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
    if (!TRY_TO_SAVE_FROM_FILE) {
      try {
        const response = await fetch(process.env.BACKEND_HOST!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
        if (!response.ok) {
          errLogger(`Backend service accessible on ${new Date()}, but have issues with saving data.`);
          updateReconnectionTimeout();
          this.write(fd, message, server);
        } else {
          RECONNECTION_TIMEOUT = 1;
        }
      } catch (error) {
        errLogger(`Backend service unaccessible on ${new Date()}`);
        updateReconnectionTimeout();
        this.write(fd, message, server);
      }
    } else {
      this.write(fd, message, server);
    }
    
  };
}
const writer = new Writer();
const reader = new Reader();

const writeListener = (fd: number, server: http.Server) => (message: Message[]): void => {
  writer.fetcher(message, fd, server);
};
const readListener = (fd: number, server: http.Server) => (): void => {
  // !TRY_TO_SAVE_FROM_FILE used for reduce number of streams
  // if it already trying to read the file and send data, we should not start another stream
  if (!TRY_TO_SAVE_FROM_FILE) {
    reader.read(server, fd)();
  }
};

export { writeListener, readListener };
