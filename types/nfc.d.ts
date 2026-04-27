// Declaraciones de tipos para la Web NFC API
// La API aún no está en TypeScript lib estándar (solo Chrome en Android)
// https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API

interface NDEFReadingEvent extends Event {
  serialNumber: string  // UID de la tarjeta NFC — lo usamos como nfc_id
  message: NDEFMessage
}

interface NDEFMessage {
  records: NDEFRecord[]
}

interface NDEFRecord {
  recordType: string
  mediaType?: string
  id?: string
  data?: DataView
  encoding?: string
  lang?: string
}

interface NDEFReaderEventMap {
  reading: NDEFReadingEvent
  readingerror: Event
}

interface NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  addEventListener<K extends keyof NDEFReaderEventMap>(
    type: K,
    listener: (ev: NDEFReaderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void
}

declare var NDEFReader: {
  prototype: NDEFReader
  new(): NDEFReader
}
