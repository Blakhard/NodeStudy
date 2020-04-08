export enum EMIT_TYPES {
  FETCH_OR_WRIGHT_LOCAL = 'FETCH_OR_WRIGHT_LOCAL',
  READ_LOCAL_AND_FETCH = 'READ_LOCAL_AND_FETCH'
}

export const allowedList = {
  '127.0.0.1': true,
  ///...
};

// for quick it made as easy as possible, but we can if we need easy scale to some normal logger (file write one)
import debug from 'debug';
export const logger = (mes: string): void =>  debug('LOG')(`LOG: ${mes}`);
export const errLogger = (mes: string): void =>  debug('ERROR')(`ERROR: ${mes}`);