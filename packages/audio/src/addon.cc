// Schlankes N-API-Addon für Audio-*Capture* über PortAudio (mit ASIO-Host auf
// Windows → Dante Virtual Soundcard mehrkanalig). Spike-MVP: initialisieren,
// Host-APIs + Geräte auflisten, EINEN Eingangsstream öffnen, Float32-planar-
// Blöcke per ThreadSafeFunction in den Node-Loop reichen, stoppen, aufräumen.
//
// Build: braucht ein gebautes PortAudio (PORTAUDIO_DIR mit include/ + lib/),
// auf Windows mit ASIO kompiliert (PA_USE_ASIO=1, Steinberg-ASIO-SDK). Siehe
// README. ASIO-SDK ist NICHT redistribuierbar → nur dagegen bauen (wie NDI-SDK).
//
// Achtung: Die PortAudio-Callback läuft auf dem Audio-Thread. Wir kopieren den
// Block (PA-Buffer ist nur während des Callbacks gültig) und reichen die Kopie
// non-blocking über die TSFN weiter — analog zur "copy, not transfer"-Lehre aus
// jm-ndi-screen-capture. Blockieren auf dem Audio-Thread würde Xruns erzeugen.

#include <napi.h>
#include <portaudio.h>
#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

namespace {

PaStream* g_stream = nullptr;
Napi::ThreadSafeFunction g_tsfn;
int g_channels = 0;

// Ein kopierter Audioblock im planaren FLTP-Layout [ch0:frames][ch1:frames]…
struct AudioBlock {
  std::vector<float> planar;  // Größe = channels * frames
  int channels = 0;
  int frames = 0;
};

void ThrowJs(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
}

// Läuft auf dem Node-Loop: baut Float32Array + ruft die JS-Callback. Übernimmt
// das Block-Eigentum und gibt es danach frei.
void CallJs(Napi::Env env, Napi::Function jsCallback, AudioBlock* block) {
  if (env != nullptr && jsCallback != nullptr) {
    const size_t len = block->planar.size();
    Napi::Float32Array arr = Napi::Float32Array::New(env, len);
    if (len > 0) {
      std::memcpy(arr.Data(), block->planar.data(), len * sizeof(float));
    }
    jsCallback.Call({
        arr,
        Napi::Number::New(env, block->channels),
        Napi::Number::New(env, block->frames),
    });
  }
  delete block;
}

// PortAudio-Audio-Thread-Callback. input ist bei paNonInterleaved ein Array von
// Kanal-Pointern (const float* const*).
int PaCallback(const void* input, void* /*output*/, unsigned long frameCount,
               const PaStreamCallbackTimeInfo* /*timeInfo*/,
               PaStreamCallbackFlags /*statusFlags*/, void* /*userData*/) {
  if (input == nullptr || g_channels <= 0) return paContinue;
  const float* const* in = static_cast<const float* const*>(input);

  auto* block = new AudioBlock();
  block->channels = g_channels;
  block->frames = static_cast<int>(frameCount);
  block->planar.resize(static_cast<size_t>(g_channels) * frameCount);

  for (int ch = 0; ch < g_channels; ++ch) {
    float* dst = block->planar.data() + static_cast<size_t>(ch) * frameCount;
    if (in[ch] != nullptr) {
      std::memcpy(dst, in[ch], frameCount * sizeof(float));
    } else {
      std::fill(dst, dst + frameCount, 0.0f);
    }
  }

  // Non-blocking: bei voller Queue/Schließen wird der Block verworfen → selbst
  // freigeben, sonst Leak. (Spike: verworfene Blöcke = Aufnahmelücke; für v0.1
  // akzeptabel, in v0.2 ggf. Ringpuffer/Backpressure.)
  if (g_tsfn.NonBlockingCall(block, CallJs) != napi_ok) {
    delete block;
  }
  return paContinue;
}

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  PaError err = Pa_Initialize();
  if (err != paNoError) {
    ThrowJs(env, Pa_GetErrorText(err));
    return env.Undefined();
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value ListHostApis(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  PaHostApiIndex count = Pa_GetHostApiCount();
  Napi::Array out = Napi::Array::New(env);
  if (count < 0) return out;
  for (PaHostApiIndex i = 0; i < count; ++i) {
    const PaHostApiInfo* h = Pa_GetHostApiInfo(i);
    if (!h) continue;
    Napi::Object o = Napi::Object::New(env);
    o.Set("index", Napi::Number::New(env, i));
    o.Set("name", Napi::String::New(env, h->name ? h->name : ""));
    o.Set("deviceCount", Napi::Number::New(env, h->deviceCount));
    o.Set("defaultInputDevice", Napi::Number::New(env, h->defaultInputDevice));
    o.Set("defaultOutputDevice", Napi::Number::New(env, h->defaultOutputDevice));
    out.Set(i, o);
  }
  return out;
}

Napi::Value ListDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  PaDeviceIndex count = Pa_GetDeviceCount();
  Napi::Array out = Napi::Array::New(env);
  if (count < 0) return out;
  for (PaDeviceIndex i = 0; i < count; ++i) {
    const PaDeviceInfo* d = Pa_GetDeviceInfo(i);
    if (!d) continue;
    const PaHostApiInfo* h = Pa_GetHostApiInfo(d->hostApi);
    Napi::Object o = Napi::Object::New(env);
    o.Set("index", Napi::Number::New(env, i));
    o.Set("name", Napi::String::New(env, d->name ? d->name : ""));
    o.Set("hostApi", Napi::Number::New(env, d->hostApi));
    o.Set("hostApiName", Napi::String::New(env, h && h->name ? h->name : ""));
    o.Set("maxInputChannels", Napi::Number::New(env, d->maxInputChannels));
    o.Set("maxOutputChannels", Napi::Number::New(env, d->maxOutputChannels));
    o.Set("defaultSampleRate", Napi::Number::New(env, d->defaultSampleRate));
    o.Set("defaultLowInputLatencySec", Napi::Number::New(env, d->defaultLowInputLatency));
    o.Set("defaultHighInputLatencySec", Napi::Number::New(env, d->defaultHighInputLatency));
    out.Set(i, o);
  }
  return out;
}

// openInput({ device, channels, sampleRate, framesPerBuffer? }, onFrames)
Napi::Value OpenInput(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_stream != nullptr) {
    ThrowJs(env, "openInput: es ist bereits ein Stream offen — zuerst stopInput()");
    return env.Undefined();
  }
  if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsFunction()) {
    ThrowJs(env, "openInput(opts, onFrames) erwartet");
    return env.Undefined();
  }

  Napi::Object opts = info[0].As<Napi::Object>();
  int device = opts.Get("device").As<Napi::Number>().Int32Value();
  int channels = opts.Get("channels").As<Napi::Number>().Int32Value();
  double sampleRate = opts.Get("sampleRate").As<Napi::Number>().DoubleValue();
  unsigned long framesPerBuffer = paFramesPerBufferUnspecified;
  if (opts.Has("framesPerBuffer")) {
    int fpb = opts.Get("framesPerBuffer").As<Napi::Number>().Int32Value();
    if (fpb > 0) framesPerBuffer = static_cast<unsigned long>(fpb);
  }

  const PaDeviceInfo* d = Pa_GetDeviceInfo(device);
  if (!d) {
    ThrowJs(env, "openInput: ungültiger Geräteindex");
    return env.Undefined();
  }

  PaStreamParameters in;
  in.device = device;
  in.channelCount = channels;
  in.sampleFormat = paFloat32 | paNonInterleaved;
  in.suggestedLatency = d->defaultLowInputLatency;
  in.hostApiSpecificStreamInfo = nullptr;  // ASIO: Default-Kanalmapping [0..n)

  g_channels = channels;
  g_tsfn = Napi::ThreadSafeFunction::New(
      env, info[1].As<Napi::Function>(), "jm_audio_frames",
      0 /* unbegrenzte Queue */, 1 /* initiale Thread-Anzahl */);

  PaError err = Pa_OpenStream(&g_stream, &in, nullptr, sampleRate, framesPerBuffer,
                              paClipOff, PaCallback, nullptr);
  if (err != paNoError) {
    g_tsfn.Release();
    g_stream = nullptr;
    g_channels = 0;
    ThrowJs(env, Pa_GetErrorText(err));
    return env.Undefined();
  }

  err = Pa_StartStream(g_stream);
  if (err != paNoError) {
    Pa_CloseStream(g_stream);
    g_stream = nullptr;
    g_channels = 0;
    g_tsfn.Release();
    ThrowJs(env, Pa_GetErrorText(err));
    return env.Undefined();
  }
  return env.Undefined();
}

Napi::Value StopInput(const Napi::CallbackInfo& info) {
  if (g_stream != nullptr) {
    Pa_StopStream(g_stream);
    Pa_CloseStream(g_stream);
    g_stream = nullptr;
    g_channels = 0;
    g_tsfn.Release();  // gibt die TSFN frei, sodass der Loop sauber leeren kann
  }
  return info.Env().Undefined();
}

Napi::Value Terminate(const Napi::CallbackInfo& info) {
  if (g_stream != nullptr) {
    Pa_StopStream(g_stream);
    Pa_CloseStream(g_stream);
    g_stream = nullptr;
    g_channels = 0;
    g_tsfn.Release();
  }
  Pa_Terminate();
  return info.Env().Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("listHostApis", Napi::Function::New(env, ListHostApis));
  exports.Set("listDevices", Napi::Function::New(env, ListDevices));
  exports.Set("openInput", Napi::Function::New(env, OpenInput));
  exports.Set("stopInput", Napi::Function::New(env, StopInput));
  exports.Set("terminate", Napi::Function::New(env, Terminate));
  return exports;
}

}  // namespace

NODE_API_MODULE(jm_audio, InitAll)
