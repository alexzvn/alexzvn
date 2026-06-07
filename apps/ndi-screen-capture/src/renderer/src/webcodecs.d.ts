// MediaStreamTrackProcessor (mediacapture-transform) ist noch nicht Teil der
// TS-DOM-Lib. VideoFrame/AudioData kommen aus der WebCodecs-Lib (vorhanden).
export {};

declare global {
  interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack;
    maxBufferSize?: number;
  }

  class MediaStreamTrackProcessor<T = VideoFrame> {
    constructor(init: MediaStreamTrackProcessorInit);
    readonly readable: ReadableStream<T>;
  }

  // Chromium unterstützt das `format`-Feld in copyTo/allocationSize (z. B. um
  // I420 → BGRA zu konvertieren); es fehlt noch in der TS-DOM-Lib.
  interface VideoFrameCopyToOptions {
    format?: VideoPixelFormat;
  }
}
