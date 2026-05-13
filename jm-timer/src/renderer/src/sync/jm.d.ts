declare global {
  interface Window {
    jm?: {
      platform: string;
      versions: Record<string, string | undefined>;
      serverUrl: string;
      speaker: {
        open: () => Promise<void>;
        close: () => Promise<void>;
        toggle: () => Promise<void>;
        isOpen: () => Promise<boolean>;
        setFullscreen: (flag: boolean) => Promise<boolean>;
        isFullscreen: () => Promise<boolean>;
        onStatus: (cb: (open: boolean) => void) => () => void;
      };
      remote: {
        getUrls: () => Promise<string[]>;
        getAddresses: () => Promise<string[]>;
      };
      auth: {
        get: () => Promise<{ enabled: boolean; token: string }>;
        setEnabled: (
          enabled: boolean,
        ) => Promise<{ enabled: boolean; token: string }>;
        regenerate: () => Promise<{ enabled: boolean; token: string }>;
      };
      closeWindow: () => Promise<void>;
    };
  }
}

export {};
