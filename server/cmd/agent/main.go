package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"go.lsp.dev/jsonrpc2"

	"github.com/Zxilly/playground-cj/server"
)

const (
	LspPath = "/cangjie/tools/bin/LSPServer"
)

func runLsp() {
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, LspPath, "src", "--disableAutoImport", "-V")
	cmd.Dir = "/playground"

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

	err := os.WriteFile("/playground/src/main.cj", data, 0644)
	if err != nil {
		panic(err)
	}

	dataMsg := server.RunMessage{}

	reportFailedCmd := func(err error, cmd *exec.Cmd, out *bytes.Buffer) {
		command := ""
		command += cmd.Path
		command += " "
		for _, arg := range cmd.Args {
			command += arg
			command += " "
		}
		command += "\n"

		dataMsg.CompilerOutput = command + err.Error() + "\n" + out.String()
		dataMsg.CompilerCode = cmd.ProcessState.ExitCode()
		b, _ := json.Marshal(dataMsg)
		Report(b)
	}

	code := string(data)

	additionalPkgs := make([]string, 0)
	if strings.Contains(code, "stdx") {
		out := bytes.NewBuffer(nil)
		// cjc --scan-dependency --package
		cmd := exec.Command("cjc", "--scan-dependency", "--package", "/playground/src")
		cmd.Dir = "/playground"
		cmd.Stdout = out
		cmd.Stderr = out
		err = cmd.Run()
		if err != nil {
			reportFailedCmd(err, cmd, out)
			return
		}
		depData := out.Bytes()
		var dep CjcDepRoot
		err = json.Unmarshal(depData, &dep)
		if err != nil {
			reportFailedCmd(err, cmd, out)
			return
		}

		for _, pkg := range dep.Dependencies {
			if !pkg.IsStd {
				additionalPkgs = append(additionalPkgs, pkg.Package)
			}
		}
	}

	compilerOut := bytes.NewBuffer(nil)
	// cjc --import-path=/linux_x86_64_llvm/dynamic --no-sub-pkg --output-dir=/playground/src
	// -L /linux_x86_64_llvm/dynamic/stdx -lstdx.encoding.json.stream -ldl -V -j1 -p /playground/src --output-type=exe -o=main

	args := []string{
		"--import-path=/linux_x86_64_llvm/dynamic",
		"--no-sub-pkg",
		"--output-dir=/playground/src",
		"-L", "/linux_x86_64_llvm/dynamic/stdx",
	}

	for _, p := range additionalPkgs {
		args = append(args, fmt.Sprintf("-l%s", p))
	}

	args = append(args, "-ldl", "-V", "-j1", "-p", "/playground/src", "--output-type=exe", "-o=main")

	cmd := exec.Command("cjc", args...)
	cmd.Stdout = compilerOut
	cmd.Stderr = compilerOut
	cmd.Dir = "/playground"
	err = cmd.Run()
	if err != nil {
		reportFailedCmd(err, cmd, compilerOut)
		return
	}

	dataMsg.CompilerOutput = compilerOut.String()
	dataMsg.CompilerCode = cmd.ProcessState.ExitCode()

	if cmd.ProcessState.Success() {
		cmd = exec.Command("/playground/src/main")
		binOut := bytes.NewBuffer(nil)
		cmd.Stdout = binOut
		cmd.Stderr = binOut
		err = cmd.Run()

		out := binOut.String()
		if out == "" && err != nil {
			out = err.Error()
		}

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
