// Schlankes N-API-Addon für den NDI-*Versand* (Send). Deckt das MVP ab:
// initialisieren, Sender erstellen, BGRA-Video + FLTP-Audio senden, Anzahl der
// Empfänger abfragen, aufräumen. Receive-Bindings kommen später hier dazu
// (gemeinsames Paket für JM NDI Screen Capture [send] und Studio-Control [recv]).
//
// Build: node-gyp rebuild (System-Node) bzw. electron-rebuild --only @jm/ndi
// (für den Einsatz im Electron-Hauptprozess/utilityProcess). Braucht das
// NDI-SDK (NDI_SDK_DIR) zur Compile-Zeit; die Runtime-DLL wird gebündelt.

#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <string>

namespace {

NDIlib_send_instance_t g_send = nullptr;

// Wirft einen JS-Error über die Node-API-C-Schnittstelle. Versionsunabhängig
// und unabhängig davon, ob C++-Exceptions an sind (NAPI_DISABLE_CPP_EXCEPTIONS).
void ThrowJs(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
}

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!NDIlib_initialize()) {
    ThrowJs(env, "NDIlib_initialize fehlgeschlagen (NDI-Runtime vorhanden?)");
    return env.Undefined();
  }
  return Napi::Boolean::New(env, true);
}

// createSender(name: string)
Napi::Value CreateSender(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    ThrowJs(env, "createSender(name: string) erwartet");
    return env.Undefined();
  }
  std::string name = info[0].As<Napi::String>().Utf8Value();

  NDIlib_send_create_t desc;          // Default-Ctor setzt sinnvolle Defaults
  desc.p_ndi_name = name.c_str();
  desc.p_groups = nullptr;
  desc.clock_video = true;            // NDI taktet das Video
  desc.clock_audio = false;

  g_send = NDIlib_send_create(&desc);
  if (!g_send) {
    ThrowJs(env, "NDIlib_send_create fehlgeschlagen");
  }
  return env.Undefined();
}

// sendVideoBGRA(buf: Buffer|Uint8Array, width, height, fpsN=30, fpsD=1)
Napi::Value SendVideoBGRA(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return env.Undefined();
  if (info.Length() < 3) {
    ThrowJs(env, "sendVideoBGRA(buf, width, height, [fpsN], [fpsD])");
    return env.Undefined();
  }

  Napi::Uint8Array buf = info[0].As<Napi::Uint8Array>();
  int w = info[1].As<Napi::Number>().Int32Value();
  int h = info[2].As<Napi::Number>().Int32Value();
  int fpsN = info.Length() > 3 ? info[3].As<Napi::Number>().Int32Value() : 30;
  int fpsD = info.Length() > 4 ? info[4].As<Napi::Number>().Int32Value() : 1;

  NDIlib_video_frame_v2_t frame;
  frame.xres = w;
  frame.yres = h;
  frame.FourCC = NDIlib_FourCC_type_BGRA;
  frame.frame_rate_N = fpsN;
  frame.frame_rate_D = fpsD;
  frame.picture_aspect_ratio = h ? static_cast<float>(w) / static_cast<float>(h) : 0.0f;
  frame.frame_format_type = NDIlib_frame_format_type_progressive;
  frame.timecode = NDIlib_send_timecode_synthesize;
  frame.p_data = buf.Data();
  frame.line_stride_in_bytes = w * 4;

  // Synchrone Variante: NDI kopiert intern → der übergebene Buffer darf direkt
  // nach Rückkehr wiederverwendet/freigegeben werden.
  NDIlib_send_send_video_v2(g_send, &frame);
  return env.Undefined();
}

// sendAudioFLTP(planar: Float32Array, channels, samples, sampleRate=48000)
// planar-Layout: [ch0: samples][ch1: samples]...
Napi::Value SendAudioFLTP(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return env.Undefined();
  if (info.Length() < 3) {
    ThrowJs(env, "sendAudioFLTP(planar, channels, samples, [sampleRate])");
    return env.Undefined();
  }

  Napi::Float32Array data = info[0].As<Napi::Float32Array>();
  int ch = info[1].As<Napi::Number>().Int32Value();
  int n = info[2].As<Napi::Number>().Int32Value();
  int sr = info.Length() > 3 ? info[3].As<Napi::Number>().Int32Value() : 48000;

  NDIlib_audio_frame_v3_t audio;
  audio.sample_rate = sr;
  audio.no_channels = ch;
  audio.no_samples = n;
  audio.timecode = NDIlib_send_timecode_synthesize;
  audio.FourCC = NDIlib_FourCC_audio_type_FLTP;
  audio.p_data = reinterpret_cast<uint8_t*>(data.Data());
  audio.channel_stride_in_bytes = n * static_cast<int>(sizeof(float));

  NDIlib_send_send_audio_v3(g_send, &audio);
  return env.Undefined();
}

// connections([timeoutMs=0]): number  → Anzahl verbundener Empfänger
Napi::Value Connections(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_send) return Napi::Number::New(env, 0);
  int timeout = info.Length() > 0 ? info[0].As<Napi::Number>().Int32Value() : 0;
  return Napi::Number::New(env, NDIlib_send_get_no_connections(g_send, timeout));
}

Napi::Value Destroy(const Napi::CallbackInfo& info) {
  if (g_send) {
    NDIlib_send_destroy(g_send);
    g_send = nullptr;
  }
  NDIlib_destroy();
  return info.Env().Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("createSender", Napi::Function::New(env, CreateSender));
  exports.Set("sendVideoBGRA", Napi::Function::New(env, SendVideoBGRA));
  exports.Set("sendAudioFLTP", Napi::Function::New(env, SendAudioFLTP));
  exports.Set("connections", Napi::Function::New(env, Connections));
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_ndi, InitAll)
