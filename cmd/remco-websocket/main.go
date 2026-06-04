package main

import (
	"log/slog"
	"net/rpc/jsonrpc"
	"os"

	"github.com/andrewheberle/remco-websocket/pkg/backend"
	"github.com/natefinch/pie"
	"github.com/spf13/pflag"
)

func main() {
	var (
		u     string
		debug bool
	)

	pflag.StringVar(&u, "url", "", "URL of service")
	pflag.BoolVar(&debug, "debug", false, "Enable debug logging")
	pflag.Parse()

	level := new(slog.LevelVar)
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))
	if debug {
		level.Set(slog.LevelDebug)
	}

	if u == "" {
		logger.Error("url must be provided")
		os.Exit(1)
	}

	srv, err := backend.NewWebsocketRPCServer(u, backend.WithLogger(logger))
	if err != nil {
		logger.Error("problem setting up backend", "error", err)
		os.Exit(1)
	}

	p := pie.NewProvider()
	if err := p.RegisterName("Plugin", srv); err != nil {
		logger.Error("problem setting plugin", "error", err)
		os.Exit(1)
	}

	p.ServeCodec(jsonrpc.NewServerCodec)
}
