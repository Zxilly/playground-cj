package main

import "os"

func Report(msg []byte) {
	_, _ = os.Stdout.Write(msg)
	_, _ = os.Stdout.Write([]byte("\n"))
}
