import { io, type Socket } from 'socket.io-client';
import { DEFAULT_COLORS } from '@shared/types';
import type { ColorConfig, CountdownState, TimerSource } from '@shared/types';

/** Minimal view of the SyncedState the JM Timer broadcasts. */
interface IncomingTimerState {
  countdown: CountdownState;
  colors: ColorConfig;
  timetable: { items: { label: string }[]; activeIndex: number | null };
  message: { text: string; blinking: boolean };
}

export const TIMER_OFFLINE: TimerSource = {
  connected: false,
  countdown: null,
  activeLabel: null,
  nextLabel: null,
  colors: { ...DEFAULT_COLORS },
  message: '',
  blinking: false,
};

/** socket.io client onto the JM Timer server (port 7777). Reconnect via socket.io. */
export class TimerClient {
  private socket: Socket | null = null;
  private readonly onChange: (s: TimerSource) => void;

  constructor(onChange: (s: TimerSource) => void) {
    this.onChange = onChange;
  }

  connect(host: string, port: number): void {
    this.disconnect();
    const socket = io(`http://${host}:${port}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 4000,
    });
    socket.on('connect', () => this.onChange({ ...TIMER_OFFLINE, connected: true }));
    socket.on('disconnect', () => this.onChange({ ...TIMER_OFFLINE }));
    socket.on('state', (st: IncomingTimerState) => this.onState(st));
    socket.on('connect_error', () => {
      /* stays offline; socket.io keeps retrying */
    });
    this.socket = socket;
  }

  private onState(st: IncomingTimerState): void {
    const tt = st.timetable;
    const activeLabel = tt.activeIndex != null ? (tt.items[tt.activeIndex]?.label ?? null) : null;
    const nextLabel = tt.activeIndex != null ? (tt.items[tt.activeIndex + 1]?.label ?? null) : null;
    this.onChange({
      connected: true,
      countdown: st.countdown,
      activeLabel,
      nextLabel,
      colors: st.colors ?? { ...DEFAULT_COLORS },
      message: st.message?.text ?? '',
      blinking: st.message?.blinking ?? false,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.onChange({ ...TIMER_OFFLINE });
  }
}
