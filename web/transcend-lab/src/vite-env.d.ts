/// <reference types="vite/client" />

declare const __TRANSCEND_SOURCE_SHA__: string;

interface Window {
  __TRANSCEND_LAB__?: import("./labRuntime").TranscendLabTestApi;
}
