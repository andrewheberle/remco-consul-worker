package backend

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	easykv "github.com/HeavyHorst/easykv"
	"github.com/andrewheberle/remco-websocket/pkg/rpc"
	"github.com/coder/websocket"
)

var _ easykv.ReadWatcher = &WebsocketRPCServer{}

type WebsocketRPCServer struct {
	ws        *websocket.Conn
	currentID uint64

	logger *slog.Logger
	opts   *websocket.DialOptions
	ctx    context.Context
	cancel context.CancelFunc

	// Concurrency fields
	writeMu sync.Mutex
	mu      sync.Mutex
	pending map[uint64]chan []byte
}

func NewWebsocketRPCServer(u string, opts ...WebsocketRPCServerOption) (*WebsocketRPCServer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// create the server with default values
	rpcServer := &WebsocketRPCServer{
		logger:    slog.New(slog.DiscardHandler),
		ctx:       ctx,
		cancel:    cancel,
		currentID: 0,
		pending:   make(map[uint64]chan []byte),
	}

	// apply options
	for _, o := range opts {
		o(rpcServer)
	}

	// dial the websocket connection
	ws, _, err := websocket.Dial(rpcServer.ctx, u, rpcServer.opts)
	if err != nil {
		cancel()
		return nil, err
	}
	rpcServer.ws = ws

	// Start the background reading loop
	go rpcServer.readLoop()

	return rpcServer, nil
}

func (s *WebsocketRPCServer) Init(args map[string]string, resp *bool) error {
	*resp = true
	return nil
}

func (s *WebsocketRPCServer) GetValues(keys []string) (map[string]string, error) {
	params := []any{keys}

	var result map[string]string
	err := s.call("getValues", params, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *WebsocketRPCServer) WatchPrefix(ctx context.Context, prefix string, opts ...easykv.WatchOption) (uint64, error) {
	return 0, easykv.ErrWatchNotSupported
}

func (s *WebsocketRPCServer) Close() {
	s.logger.Debug("closing websocket connection")
	s.cancel() // Stop the read loop
	if err := s.ws.Close(websocket.StatusNormalClosure, ""); err != nil {
		s.logger.Error("error closing websocket", "error", err)
	}
}

// readLoop runs continuously in the background, consuming all messages from the WebSocket server
func (s *WebsocketRPCServer) readLoop() {
	defer func() {
		// Cleanup all pending channels if the connection drops or loop ends
		s.mu.Lock()
		for id, ch := range s.pending {
			close(ch)
			delete(s.pending, id)
		}
		s.mu.Unlock()
	}()

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
			t, b, err := s.ws.Read(s.ctx)
			if err != nil {
				if errors.Is(err, context.Canceled) || websocket.CloseStatus(err) != -1 {
					s.logger.Debug("read loop terminating via closed connection or context cancel")
					return
				}
				s.logger.Error("failed to read from websocket", "error", err)
				return
			}

			if t != websocket.MessageText {
				s.logger.Warn("received non-text message payload; ignoring")
				continue
			}

			// Do a minimal unmarshal just to parse the ID out of the incoming JSON-RPC wrapper
			var partialResp struct {
				ID uint64 `json:"id"`
			}
			if err := json.Unmarshal(b, &partialResp); err != nil {
				s.logger.Error("failed to extract ID from incoming response payload", "error", err)
				continue
			}

			s.mu.Lock()
			ch, ok := s.pending[partialResp.ID]
			if ok {
				ch <- b // Pass raw bytes to the waiting caller channel
				delete(s.pending, partialResp.ID)
			} else {
				s.logger.Warn("received unmatched RPC message ID", "id", partialResp.ID)
			}
			s.mu.Unlock()
		}
	}
}

func (s *WebsocketRPCServer) call(method string, params any, target any) error {
	id := atomic.AddUint64(&s.currentID, 1)
	req := rpc.Request{
		JsonRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      id,
	}

	s.logger.Debug("new request", "method", method, "id", id)

	b, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create and register a matching channel for our generated ID
	resCh := make(chan []byte, 1)
	s.mu.Lock()
	s.pending[id] = resCh
	s.mu.Unlock()

	// Ensure cleanup in case of context expiration/timeouts
	defer func() {
		s.mu.Lock()
		delete(s.pending, id)
		s.mu.Unlock()
	}()

	// Send the request safely with a mutex lock to guard concurrent writes
	if err := s.write(b); err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}

	// Wait for either a response payload from the read loop, or a 2-second timeout
	timeoutCtx, timeoutCancel := context.WithTimeout(context.Background(), time.Second*2)
	defer timeoutCancel()

	var responseBytes []byte
	select {
	case <-timeoutCtx.Done():
		return fmt.Errorf("rpc request timed out waiting for server response: %w", timeoutCtx.Err())
	case <-s.ctx.Done():
		return fmt.Errorf("server context ended while waiting for response: %w", s.ctx.Err())
	case res, ok := <-resCh:
		if !ok {
			return fmt.Errorf("websocket connection severed during processing")
		}
		responseBytes = res
	}

	var resp rpc.Response
	if err := json.Unmarshal(responseBytes, &resp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if resp.Error != nil {
		return fmt.Errorf("rpc error [%d]: %s", resp.Error.Code, resp.Error.Message)
	}

	if target != nil && resp.Result != nil {
		if err := json.Unmarshal(resp.Result, target); err != nil {
			return fmt.Errorf("failed to unmarshal result: %w", err)
		}
	}

	return nil
}

func (s *WebsocketRPCServer) write(b []byte) error {
	writeCtx, writeCancel := context.WithTimeout(context.Background(), time.Second*2)
	defer writeCancel()

	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	return s.ws.Write(writeCtx, websocket.MessageText, b)
}

type WebsocketRPCServerOption func(*WebsocketRPCServer)

func WithLogger(logger *slog.Logger) WebsocketRPCServerOption {
	return func(s *WebsocketRPCServer) {
		s.logger = logger
	}
}

func WithDialOptions(opts *websocket.DialOptions) WebsocketRPCServerOption {
	return func(s *WebsocketRPCServer) {
		s.opts = opts
	}
}

func WithContext(ctx context.Context) WebsocketRPCServerOption {
	return func(s *WebsocketRPCServer) {
		// Inherit the context state provided, but layer cancel capabilities over it
		s.ctx, s.cancel = context.WithCancel(ctx)
	}
}
