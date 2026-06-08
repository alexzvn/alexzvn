{
  "targets": [
    {
      "target_name": "jm_audio",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(node -p \"(process.env.PORTAUDIO_DIR || '') + '/include'\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "<!(node -p \"(process.env.PORTAUDIO_DIR || '') + '/lib/portaudio_x64.lib'\")"
          ]
        }],
        ["OS=='mac'", {
          "library_dirs": [
            "<!(node -p \"(process.env.PORTAUDIO_DIR || '') + '/lib'\")"
          ],
          "libraries": ["-lportaudio"]
        }],
        ["OS=='linux'", {
          "library_dirs": [
            "<!(node -p \"(process.env.PORTAUDIO_DIR || '') + '/lib'\")"
          ],
          "libraries": ["-lportaudio"]
        }]
      ]
    }
  ]
}
