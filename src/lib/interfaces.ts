import { Address4 } from 'ip-address';

export interface Message {
  message: string;
  ip: Address4['address'];
  timestamp: number;
}

export interface AllowedIPs {
  [ip: string]: boolean;
}

export interface FileInit {
  fd: number;
  currentData?: Message[];
}