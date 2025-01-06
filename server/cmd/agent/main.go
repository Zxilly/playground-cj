package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"go.lsp.dev/jsonrpc2"
	"go.lsp.dev/protocol"

	"github.com/playground-cj/server"
)

const (
	LspPath  = "/cangjie/tools/bin/LSPServer"
	CodeFile = "/playground/src/main.cj"
)

var (
	fileVersion int32 = 0
)

func init() {
	// open /tmp/stderr.log
	f, err := os.OpenFile("/tmp/stderr.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		panic(err)
	}
	// redirect stderr to /tmp/stderr.log
	os.Stderr = f
}

func trySyncFile(msg jsonrpc2.Message) {
	resq, ok := msg.(*jsonrpc2.Notification)
	if !ok {
		return
	}

	if resq.Method() != protocol.MethodTextDocumentDidChange && resq.Method() != protocol.MethodTextDocumentDidOpen {
		return
	}

	fileContent := Must2(os.ReadFile(CodeFile))

	if resq.Method() == protocol.MethodTextDocumentDidChange {
		params := protocol.DidChangeTextDocumentParams{}
		Must(json.Unmarshal(resq.Params(), &params))

		if params.TextDocument.Version < fileVersion {
			return
		}

		for _, change := range params.ContentChanges {
			m := NewMapper(DocumentURI(params.TextDocument.URI), fileContent)
			start, end, err := m.RangeOffsets(change.Range)
			if err != nil {
				panic(err)
			}
			if end < start {
				panic("end < start")
			}
			var buf bytes.Buffer
			buf.Write(fileContent[:start])
			buf.WriteString(change.Text)
			buf.Write(fileContent[end:])
			fileContent = buf.Bytes()
		}

		fileVersion = params.TextDocument.Version
	} else if resq.Method() == protocol.MethodTextDocumentDidOpen {
		params := protocol.DidOpenTextDocumentParams{}
		Must(json.Unmarshal(resq.Params(), &params))

		fileContent = []byte(params.TextDocument.Text)
		fileVersion = params.TextDocument.Version
	}

	Must(os.WriteFile(CodeFile, fileContent, 0644))
}

func runLsp() {
	err := os.MkdirAll("/playground", 0755)
	if err != nil {
		panic(err)
	}

	ctx := context.Background()

	cmd := exec.Command("cjpm", "init")
	cmd.Dir = "/playground"
	Must(cmd.Run())

	cmd = exec.CommandContext(ctx, LspPath, "src", "--disableAutoImport", "-V")

	stdout := Must2(cmd.StdoutPipe())
	stderr := Must2(cmd.StderrPipe())
	stdin := Must2(cmd.StdinPipe())

	go func() {
		Must2(io.Copy(os.Stderr, stderr))
	}()

	c := &mixedReadWriteCloser{r: stdout, w: stdin}
	stream := jsonrpc2.NewStream(c)

	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			data := scanner.Bytes()

			rpcMsg := Must2(jsonrpc2.DecodeMessage(data))

			trySyncFile(rpcMsg)

			//if msg := tryRewriteInit(rpcMsg); msg != nil {
			//	rpcMsg = msg
			//}

			Must2(stream.Write(ctx, rpcMsg))
		}
	}()

	go func() {
		for {
			msg, _, err := stream.Read(ctx)
			if err != nil {
				panic(err)
			}
			data := Must2(json.Marshal(msg))
			Report(data)
		}
	}()

	Must(cmd.Run())
}

func format(fMsg server.ForwardMessage) {
	data := fMsg.Data

	tmp, err := os.CreateTemp("", "playground.*.cj")
	if err != nil {
		panic(err)
	}
	defer func(name string) {
		_ = os.Remove(name)
	}(tmp.Name())
	_ = os.WriteFile(tmp.Name(), data, 0644)
	defer func(tmp *os.File) {
		_ = tmp.Close()
	}(tmp)

	cmd := exec.Command("cjfmt", "-f", tmp.Name(), "-o", tmp.Name())

	cjfmtOut := bytes.NewBuffer(nil)
	cmd.Stdout = cjfmtOut
	cmd.Stderr = cjfmtOut
	_ = cmd.Run()

	out, _ := os.ReadFile(tmp.Name())

	ffMsg := server.FormatMessage{
		Formatted:       string(out),
		FormatterOutput: cjfmtOut.String(),
		FormatterCode:   cmd.ProcessState.ExitCode(),
	}

	b, _ := json.Marshal(ffMsg)
	Report(b)
}

func run(fMsg server.ForwardMessage) {
	data := fMsg.Data

	tmp, err := os.CreateTemp("", "playground.*.cj")
	if err != nil {
		panic(err)
	}
	defer func(name string) {
		_ = os.Remove(name)
	}(tmp.Name())
	_ = os.WriteFile(tmp.Name(), data, 0644)
	defer func(tmp *os.File) {
		_ = tmp.Close()
	}(tmp)

	// random binary name
	tmpBin := filepath.Join(os.TempDir(), server.RandomString(10))
	defer func(name string) {
		_ = os.Remove(name)
	}(tmpBin)

	dataMsg := server.RunMessage{}

	compilerOut := bytes.NewBuffer(nil)

	// cjc --static-std --static-libs -o main main.cj && /sandbox/main
	cmd := exec.Command("cjc", "--static-std", "--static-libs", "-o", tmpBin, tmp.Name())
	cmd.Stdout = compilerOut
	cmd.Stderr = compilerOut
	_ = cmd.Run()

	dataMsg.CompilerOutput = compilerOut.String()
	dataMsg.CompilerCode = cmd.ProcessState.ExitCode()

	if cmd.ProcessState.Success() {
		cmd = exec.Command(tmpBin)
		binOut := bytes.NewBuffer(nil)
		cmd.Stdout = binOut
		cmd.Stderr = binOut
		_ = cmd.Run()

		dataMsg.BinOutput = binOut.String()
		dataMsg.BinCode = cmd.ProcessState.ExitCode()
	}

	b, _ := json.Marshal(dataMsg)
	Report(b)
}

func loadForwardMessage() server.ForwardMessage {
	// readline from stdin
	scan := bufio.NewScanner(os.Stdin)
	scan.Split(bufio.ScanLines)
	for scan.Scan() {
		v := scan.Bytes()
		msg := server.ForwardMessage{}
		err := json.Unmarshal(v, &msg)
		if err != nil {
			_, _ = os.Stderr.Write([]byte(err.Error()))
			continue
		}
		return msg
	}
	panic("unexpected end of input")
}

func main() {
	if len(os.Args) < 2 {
		panic("missing required argument: type")
	}

	typ := os.Args[1]

	switch typ {
	case "lsp":
		runLsp()
	case "format":
		format(loadForwardMessage())
	case "run":
		run(loadForwardMessage())
	}
}
