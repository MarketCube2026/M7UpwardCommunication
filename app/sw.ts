import { Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare const self: any;
const serwist = new Serwist({ precacheEntries: self.__SW_MANIFEST, runtimeCaching: defaultCache, skipWaiting: true, clientsClaim: true });
serwist.addEventListeners();
