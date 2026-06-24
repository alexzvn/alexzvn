// QR-Code als Data-URL (für das Publikums-Voting per Handy). qrcode ist reines JS
// → im Renderer bündelbar (wie apps/presenter / apps/qa).
import QRCode from 'qrcode';

export function toDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
