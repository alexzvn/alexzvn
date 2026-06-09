declare global {
  interface Window {
    jms?: {
      platform: string;
      versions: Record<string, string | undefined>;
      serverUrl: string;
      isElectron: boolean;
      remote: {
        getUrls: () => Promise<string[]>;
        getAddresses: () => Promise<string[]>;
      };
      closeWindow: () => Promise<void>;
    };
  }
}

export {};
