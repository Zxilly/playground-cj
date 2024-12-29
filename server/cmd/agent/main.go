package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/playground-cj/server"
)

const (
	LspPath = "/cangjie/tools/bin/LSPServer"
)

func runLsp() {
	err := os.MkdirAll("/workspace", 0755)
	if err != nil {
		panic(err)
	}
	cmd := exec.Command("cjpm", "init")
	cmd.Dir = "/workspace"
	Must(cmd.Run())

	cmd = exec.Command(LspPath, "src", "-V")
	cmd.Dir = "/workspace"

	stdout := Must2(cmd.StdoutPipe())
	stderr := Must2(cmd.StderrPipe())
	stdin := Must2(cmd.StdinPipe())

	go func() {
		_, _ = io.Copy(os.Stderr, stderr)
	}()

	go func() {
		_, _ = io.Copy(stdin, os.Stdin)
	}()

	go func() {
		_, _ = io.Copy(os.Stdout, stdout)
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
