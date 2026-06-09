{
  "targets": [
    {
      "target_name": "jm_ndi",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(node -p \"process.env.NDI_SDK_DIR + '/Include'\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "<!(node -p \"process.env.NDI_SDK_DIR + '/Lib/x64/Processing.NDI.Lib.x64.lib'\")"
          ]
        }],
        ["OS=='mac'", {
          "library_dirs": [
            "<!(node -p \"process.env.NDI_SDK_DIR + '/lib/macOS'\")"
          ],
          "libraries": ["-lndi"]
        }]
      ]
    }
  ]
}
