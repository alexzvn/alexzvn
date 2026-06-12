import {
  dbToSq14,
  dbToYamaha,
  type AudioAction,
  type ConsoleType,
} from '@shared/audio';

// Native TCP control encoders per console. The byte structure is what gets
// verified against the mock desks; the exact A&H level taper / NRPN+note
// numbers are best-effort and flagged — confirm against the real SQ5.

export interface ConsoleAdapter {
  /** Encode an action into native control bytes for TCP/Dante, or null if the
   *  action isn't supported. */
  encodeTcp(action: AudioAction): Buffer | null;
  /** Optional keep-alive / identity probe (currently only Yamaha). */
  probe?(): Buffer | null;
}

// ---- Yamaha QL: RCP/SCP, ASCII lines terminated by \n. Channels 0-indexed. ----
const yamaha: ConsoleAdapter = {
  encodeTcp(action) {
    const ch = action.channel - 1;
    if (action.kind === 'fader') {
      return Buffer.from(
        `set MIXER:Current/InCh/Fader/Level ${ch} 0 ${dbToYamaha(action.db)}\n`,
        'ascii',
      );
    }
    // Fader/On = 1 means the channel is ON (unmuted); mute.on=true → 0.
    return Buffer.from(
      `set MIXER:Current/InCh/Fader/On ${ch} 0 ${action.on ? 0 : 1}\n`,
      'ascii',
    );
  },
  probe() {
    return Buffer.from('devinfo productname\n', 'ascii');
  },
};

// ---- Allen & Heath SQ: MIDI over TCP. Base MIDI channel 1 (n=0). ----
// Fader  → NRPN (CC99/98 select, CC6/38 data). Mute → Note-On (vel ≥0x40 = on).
const SQ_MIDI_CH = 0; // base channel 1
const SQ_NRPN_MSB = 0x40; // input-fader bank (flagged — verify on desk)

const ahSq: ConsoleAdapter = {
  encodeTcp(action) {
    const n = SQ_MIDI_CH & 0x0f;
    if (action.kind === 'fader') {
      const { msb, lsb } = dbToSq14(action.db);
      const param = action.channel - 1;
      return Buffer.from([
        0xb0 | n, 99, SQ_NRPN_MSB,
        0xb0 | n, 98, param & 0x7f,
        0xb0 | n, 6, msb,
        0xb0 | n, 38, lsb,
      ]);
    }
    const note = (action.channel - 1) & 0x7f;
    const vel = action.on ? 0x7f : 0x3f; // ≥0x40 = mute on
    return Buffer.from([0x90 | n, note, vel]);
  },
};

export function getAdapter(type: ConsoleType): ConsoleAdapter {
  return type === 'ah-sq' ? ahSq : yamaha;
}
