'use client'

import {useEffect, useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {ChevronDown, ChevronUp} from 'lucide-react'

interface Response {
  id: string
  ok: boolean
  duration: number
  stdout: string
  stderr: string
}

const defaultCode = `package cangjie

// 编写你的第一个仓颉程序
main(): Int64 {
    println("你好，仓颉！")
    return 0
}
`

export default function Component() {
  const [code, setCode] = useState(defaultCode)
  const [compilerOutput, setCompilerOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const [lineCount, setLineCount] = useState(50)

  const codeRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (lineNumbersRef.current && codeRef.current) {
        lineNumbersRef.current.scrollTop = codeRef.current.scrollTop
      }
    }

    const codeElement = codeRef.current
    codeElement?.addEventListener('scroll', handleScroll)

    return () => {
      codeElement?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    setLineCount(code.split('\n').length)
  }, [code])

  const handleRun = () => {
    setCompilerOutput('Compiling...')
    setProgramOutput('Running...')
    fetch("https://cj-api.learningman.top/v1/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "sandbox": "cangjie",
        "command": "run",
        "files": {
          "": code
        }
      })
    }).then(res => res.json()).then((data: Response) => {
      if (data.stderr.length > 0) {
        setCompilerOutput(data.stderr)
      } else {
        setCompilerOutput("Compiled successfully")
      }
      setProgramOutput(data.stdout)
    })
  }

  const handleFormat = () => {
    setCode(code.trim() + '\n')
    setCompilerOutput('Code formatted')
  }

  const handleLint = () => {
    setCompilerOutput('Linting complete: No issues found')
  }

  const toggleOutput = () => {
    setIsOutputCollapsed(!isOutputCollapsed)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex-none p-2 md:p-4 flex flex-col md:flex-row justify-between items-center">
        <h1 className="text-2xl font-bold mb-2 md:mb-0">仓颉 Playground</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
          <Button onClick={handleRun} className="w-full sm:w-auto">运行</Button>
          {/*<Button onClick={handleFormat} className="w-full sm:w-auto">格式化</Button>*/}
          {/*<Button onClick={handleLint} className="w-full sm:w-auto">Lint</Button>*/}
        </div>
      </div>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 p-2 md:p-4 flex flex-col overflow-hidden">
          <div className="flex-1 flex border rounded overflow-hidden">
            <div
              ref={lineNumbersRef}
              className="w-12 bg-muted text-right font-mono text-xs md:text-sm text-muted-foreground overflow-hidden"
              style={{
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
              }}
            >
              <div className="h-full pr-2 md:pr-4">
                {Array.from({length: lineCount}, (_, i) => (
                  <div key={i} className="leading-4 md:leading-5">{i + 1}</div>
                ))}
              </div>
            </div>
            <textarea
              ref={codeRef}
              className="flex-1 px-1 md:px-2 font-mono text-xs md:text-sm bg-transparent resize-none outline-none overflow-y-scroll"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
            />
          </div>
        </div>
        <div className="w-full md:w-1/3 p-2 md:p-4 flex flex-col overflow-hidden">
          <div className="md:hidden mb-2">
            <Button onClick={toggleOutput} variant="outline" className="w-full flex justify-between items-center">
              <span>Output</span>
              {isOutputCollapsed ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}
            </Button>
          </div>
          <div className={`flex-1 ${isOutputCollapsed ? 'hidden' : 'flex'} md:flex flex-col`}>
            <div className="flex flex-col flex-1 mb-2 md:mb-4">
              <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Compiler Output</h2>
              <pre
                className="flex-1 min-h-[5rem] md:min-h-0 p-1 md:p-2 border rounded font-mono text-xs md:text-sm bg-muted overflow-y-auto">
                {compilerOutput}
              </pre>
            </div>
            <div className="flex flex-col flex-1">
              <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">Program Output</h2>
              <pre
                className="flex-1 min-h-[5rem] md:min-h-0 p-1 md:p-2 border rounded font-mono text-xs md:text-sm bg-muted overflow-y-auto">
                  {programOutput}
              </pre>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none p-4 text-center text-sm text-muted-foreground">
        <a href="https://github.com/Zxilly/playground-cj" className="hover:underline" target="_blank"
           rel="noopener noreferrer">
          View source code on GitHub
        </a>
      </div>
    </div>
  )
}
