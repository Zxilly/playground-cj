package main

import "os"

func Report(msg []byte) {
	_, _ = os.Stdout.Write(msg)
	_, _ = os.Stdout.Write([]byte("\n"))
}

func Must(err error) {
	if err != nil {
		panic(err)
	}
}

func Must2[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}
