package backend_test

import (
	"log/slog"
	"maps"
	"os"
	"testing"

	"github.com/andrewheberle/remco-websocket/pkg/backend"
)

func TestWebsocketRPCServer_GetValues(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug}))

	s, err := backend.NewWebsocketRPCServer("http://127.0.0.1:8787/json-rpc", backend.WithLogger(logger))
	if err != nil {
		t.Fatalf("could not construct receiver type: %v", err)
	}
	defer s.Close()

	tests := []struct {
		name string // description of this test case
		// Named input parameters for target function.
		keys    []string
		want    map[string]string
		wantErr bool
	}{
		{"/foo", []string{"/foo"}, map[string]string{"/foo": "bar"}, false},
		{"/this", []string{"/this"}, map[string]string{"/this": "that", "/this/and": "thatis"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := s.GetValues(tt.keys)
			if gotErr != nil {
				if !tt.wantErr {
					t.Errorf("GetValues() failed: %v", gotErr)
				}
				return
			}
			if tt.wantErr {
				t.Fatal("GetValues() succeeded unexpectedly")
			}

			if !maps.Equal(got, tt.want) {
				t.Errorf("GetValues() = %v, want %v", got, tt.want)
			}
		})
	}
}
