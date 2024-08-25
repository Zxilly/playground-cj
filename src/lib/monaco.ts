import {loader, type Monaco} from "@monaco-editor/react";
import {shikiToMonaco} from '@shikijs/monaco'
import {createHighlighter} from "shiki";

import grammer from "./Cangjie.tmLanguage.json"
import langConf from "./language-configuration.json"

loader.config({
  paths: {
    vs: "https://registry.npmmirror.com/monaco-editor/0.51.0/files/min/vs"
  },
  "vs/nls": {
    availableLanguages: {
      "*": "zh-cn"
    }
  }
})

export function getSetup(run: () => void, share: () => void) {
  return function (monaco: Monaco) {
    monaco.languages.register({id: 'cangjie'});
    monaco.languages.setLanguageConfiguration('cangjie', langConf as any);

    monaco.editor.addEditorAction({
      id: 'compileAndRun',
      label: '编译运行',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      ],
      run: function() {
        run();
      }
    });

    (async function () {
      const highlighter = await createHighlighter({
        themes: [
          'vitesse-light',
        ],
        langs: [
          grammer as any,
        ],
      })

      shikiToMonaco(highlighter, monaco)
    })()
  }
}
