// N-API-Addon für NDI *Send* + *Receive*. Send deckt das Screen-Capture-MVP ab;
// Receive (Quellen finden, verbinden, BGRA-Video + FLTP-Audio empfangen) ist die
// Grundlage für den JM Switcher (NDI-Input) und die NDI-PGM-Vorschau in Studio
// Control. Alle Aufrufe sind synchron; der Konsument pollt receive() in einer
// Schleife (z. B. im utilityProcess). Frames werden vor dem Freigeben KOPIERT
// (Copy-not-reference-Disziplin wie im Rest der Suite).
//
// Build: node-gyp rebuild bzw. electron-rebuild --only @jm/ndi. Braucht das
// NDI-SDK (NDI_SDK_DIR) zur Compile-Zeit; die Runtime-DLL wird gebündelt.

#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <cstring>
#include <string>

namespace {

NDIlib_send_instance_t g_send = nullptr;
NDIlib_recv_instance_t g_recv = nullptr;

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

// ===================== SEND =====================

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

  NDIlib_send_send_video_v2(g_send, &frame);
  return env.Undefined();
}

// sendAudioFLTP(planar: Float32Array, channels, samples, sampleRate=48000)
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

// ===================== RECEIVE =====================

// findSources([timeoutMs=1000]): string[]  → sichtbare NDI-Quellnamen
Napi::Value FindSources(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int timeout = info.Length() > 0 ? info[0].As<Napi::Number>().Int32Value() : 1000;

  NDIlib_find_create_t fdesc;          // Default-Ctor
  fdesc.show_local_sources = true;
  fdesc.p_groups = nullptr;
  fdesc.p_extra_ips = nullptr;

  NDIlib_find_instance_t finder = NDIlib_find_create_v2(&fdesc);
  if (!finder) {
    ThrowJs(env, "NDIlib_find_create_v2 fehlgeschlagen");
    return env.Undefined();
  }

  NDIlib_find_wait_for_sources(finder, timeout < 0 ? 0 : static_cast<uint32_t>(timeout));
  uint32_t count = 0;
  const NDIlib_source_t* srcs = NDIlib_find_get_current_sources(finder, &count);

  Napi::Array out = Napi::Array::New(env, count);
  for (uint32_t i = 0; i < count; ++i) {
    out.Set(i, Napi::String::New(env, srcs[i].p_ndi_name ? srcs[i].p_ndi_name : ""));
  }
  NDIlib_find_destroy(finder);
  return out;
}

// createReceiver(sourceName: string): boolean
Napi::Value CreateReceiver(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    ThrowJs(env, "createReceiver(sourceName: string) erwartet");
    return env.Undefined();
  }
  std::string name = info[0].As<Napi::String>().Utf8Value();

  NDIlib_source_t source;
  source.p_ndi_name = name.c_str();
  source.p_url_address = nullptr;

  NDIlib_recv_create_v3_t rdesc;       // Default-Ctor
  rdesc.source_to_connect_to = source;
  rdesc.color_format = NDIlib_recv_color_format_BGRX_BGRA; // BGRA wie der Sender/Compositor
  rdesc.bandwidth = NDIlib_recv_bandwidth_highest;
  rdesc.allow_video_fields = false;
  rdesc.p_ndi_recv_name = "JM Receiver";

  if (g_recv) {
    NDIlib_recv_destroy(g_recv);
    g_recv = nullptr;
  }
  g_recv = NDIlib_recv_create_v3(&rdesc);
  if (!g_recv) {
    ThrowJs(env, "NDIlib_recv_create_v3 fehlgeschlagen");
    return Napi::Boolean::New(env, false);
  }
  return Napi::Boolean::New(env, true);
}

// receive([timeoutMs=100]): VideoFrame | AudioFrame | null
//  Video: { type:'video', data:Buffer(BGRA), width, height, lineStride, fourCC, fpsN, fpsD }
//  Audio: { type:'audio', data:Float32Array(FLTP-planar), channels, samples, sampleRate }
Napi::Value Receive(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_recv) return env.Null();
  int timeout = info.Length() > 0 ? info[0].As<Napi::Number>().Int32Value() : 100;

  NDIlib_video_frame_v2_t video;
  NDIlib_audio_frame_v3_t audio;
  NDIlib_frame_type_e type = NDIlib_recv_capture_v3(
      g_recv, &video, &audio, nullptr, timeout < 0 ? 0 : static_cast<uint32_t>(timeout));

  if (type == NDIlib_frame_type_video) {
    const size_t bytes = static_cast<size_t>(video.line_stride_in_bytes) * video.yres;
    Napi::Object o = Napi::Object::New(env);
    o.Set("type", Napi::String::New(env, "video"));
    o.Set("width", Napi::Number::New(env, video.xres));
    o.Set("height", Napi::Number::New(env, video.yres));
    o.Set("lineStride", Napi::Number::New(env, video.line_stride_in_bytes));
    o.Set("fourCC", Napi::Number::New(env, static_cast<int>(video.FourCC)));
    o.Set("fpsN", Napi::Number::New(env, video.frame_rate_N));
    o.Set("fpsD", Napi::Number::New(env, video.frame_rate_D));
    // Kopie — der NDI-Frame wird direkt danach freigegeben.
    o.Set("data", Napi::Buffer<uint8_t>::Copy(env, video.p_data, bytes));
    NDIlib_recv_free_video_v2(g_recv, &video);
    return o;
  }

  if (type == NDIlib_frame_type_audio) {
    const int ch = audio.no_channels;
    const int n = audio.no_samples;
    Napi::Float32Array arr = Napi::Float32Array::New(env, static_cast<size_t>(ch) * n);
    const uint8_t* base = reinterpret_cast<const uint8_t*>(audio.p_data);
    // FLTP: pro Kanal channel_stride_in_bytes; in zusammenhängendes
    // [ch0:n][ch1:n]… kopieren (gleiche Konvention wie sendAudioFLTP).
    for (int c = 0; c < ch; ++c) {
      const float* srcCh =
          reinterpret_cast<const float*>(base + static_cast<size_t>(c) * audio.channel_stride_in_bytes);
      std::memcpy(arr.Data() + static_cast<size_t>(c) * n, srcCh, static_cast<size_t>(n) * sizeof(float));
    }
    Napi::Object o = Napi::Object::New(env);
    o.Set("type", Napi::String::New(env, "audio"));
    o.Set("channels", Napi::Number::New(env, ch));
    o.Set("samples", Napi::Number::New(env, n));
    o.Set("sampleRate", Napi::Number::New(env, audio.sample_rate));
    o.Set("data", arr);
    NDIlib_recv_free_audio_v3(g_recv, &audio);
    return o;
  }

  // none / status_change / error → nichts Brauchbares in diesem Tick
  return env.Null();
}

// closeReceiver()
Napi::Value CloseReceiver(const Napi::CallbackInfo& info) {
  if (g_recv) {
    NDIlib_recv_destroy(g_recv);
    g_recv = nullptr;
  }
  return info.Env().Undefined();
}

// ===================== TEARDOWN =====================

Napi::Value Destroy(const Napi::CallbackInfo& info) {
  if (g_send) {
    NDIlib_send_destroy(g_send);
    g_send = nullptr;
  }
  if (g_recv) {
    NDIlib_recv_destroy(g_recv);
    g_recv = nullptr;
  }
  NDIlib_destroy();
  return info.Env().Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  // Send
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("createSender", Napi::Function::New(env, CreateSender));
  exports.Set("sendVideoBGRA", Napi::Function::New(env, SendVideoBGRA));
  exports.Set("sendAudioFLTP", Napi::Function::New(env, SendAudioFLTP));
  exports.Set("connections", Napi::Function::New(env, Connections));
  // Receive
  exports.Set("findSources", Napi::Function::New(env, FindSources));
  exports.Set("createReceiver", Napi::Function::New(env, CreateReceiver));
  exports.Set("receive", Napi::Function::New(env, Receive));
  exports.Set("closeReceiver", Napi::Function::New(env, CloseReceiver));
  // Teardown
  exports.Set("destroy", Napi::Function::New(env, Destroy));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_ndi, InitAll)
