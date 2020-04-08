import http from 'http';

import url from 'url';
import { Address4 } from 'ip-address';

import { AllowedIPs, Message } from '../lib/interfaces';

const badRequest = (res: http.ServerResponse): void => {
  res.statusCode = 400;
  res.end('Bad request');
};

const checker = 
(allowedIps: AllowedIPs | false, req: http.IncomingMessage, res: http.ServerResponse):
Partial<Message> | false => {
  const toSave: Partial<Message> = {};

  if (allowedIps) {
    if (allowedIps[req.connection.remoteAddress!]) {
      toSave.ip = (new Address4(req.connection.remoteAddress!)).address;
    } else {
      res.statusCode = 403;
      res.end('Forbidden');
      return false;
    }
  } else {
    toSave.ip = (new Address4(req.connection.remoteAddress!)).address;
  }

  if (!(req.method === 'GET' || req.method === 'POST')){
    res.statusCode = 405;
    res.end('Method not allowed');
    return false;
  }

  if (req.method === 'POST') {
    const { "content-type": contentType } = req.headers;
    if (!contentType || contentType !== 'application/json') {
      badRequest(res);
      return false;
    }
  }

  const reqUrl = url.parse(req.url!, true);
  const { pathname } = reqUrl;
  if (pathname !== '/collect') {
    res.statusCode = 404;
    res.end('Method not found :(');
    return false;
  }

  // in case of a lot of bots, keep connection alive can lead to 
  // many open connections at once, so on each request we say that connection have to be closed;
  res.setHeader('Connection', 'close');
  return toSave;
};

const checkOptions = (allowedIps: AllowedIPs | false, req: http.IncomingMessage, res: http.ServerResponse): boolean => {
  if (req.method === 'OPTIONS') {
    if (allowedIps && !allowedIps[req.connection.remoteAddress!]) {
      res.statusCode = 403;
      res.end('Forbidden');
      return true;
    }
    res.setHeader('Accept', 'application/json');
    res.statusCode = 200;
    res.end('Ok');
    return true;
  }
  return false;
};

export {
  checker,
  checkOptions,
  badRequest,
};
