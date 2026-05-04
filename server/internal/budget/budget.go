package budget

import (
	"errors"
	"sync"
	"time"
)

// ErrExceeded is returned when a charge would push the IP over its allotment.
var ErrExceeded = errors.New("budget exceeded for this IP")

type entry struct {
	mu        sync.Mutex
	remaining float64
	resetAt   time.Time
}

// Manager tracks per-IP USD budgets, resetting at a fixed window.
type Manager struct {
	mu          sync.Mutex
	entries     map[string]*entry
	defaultUSD  float64
	window      time.Duration
	stopCleanup chan struct{}
}

// New constructs a new budget Manager with the given per-IP default budget and
// reset window. The Manager runs a background goroutine to clean up expired
// entries; call Close to terminate it.
func New(defaultUSD float64, window time.Duration) *Manager {
	m := &Manager{
		entries:     make(map[string]*entry),
		defaultUSD:  defaultUSD,
		window:      window,
		stopCleanup: make(chan struct{}),
	}
	go m.cleanupLoop()
	return m
}

func (m *Manager) Close() {
	close(m.stopCleanup)
}

func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-m.stopCleanup:
			return
		case now := <-ticker.C:
			m.gc(now)
		}
	}
}

func (m *Manager) gc(now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for ip, e := range m.entries {
		e.mu.Lock()
		expired := now.After(e.resetAt)
		e.mu.Unlock()
		if expired {
			delete(m.entries, ip)
		}
	}
}

func (m *Manager) get(ip string) *entry {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.entries[ip]
	if !ok {
		e = &entry{
			remaining: m.defaultUSD,
			resetAt:   time.Now().Add(m.window),
		}
		m.entries[ip] = e
	}
	return e
}

func (m *Manager) refreshIfExpired(e *entry, now time.Time) {
	if now.After(e.resetAt) {
		e.remaining = m.defaultUSD
		e.resetAt = now.Add(m.window)
	}
}

// Snapshot returns the remaining budget and reset time for an IP.
func (m *Manager) Snapshot(ip string) (remaining float64, resetAt time.Time) {
	e := m.get(ip)
	e.mu.Lock()
	defer e.mu.Unlock()
	m.refreshIfExpired(e, time.Now())
	return e.remaining, e.resetAt
}

// Acquire pre-checks that the estimated cost can fit. It does not deduct.
// Returns ErrExceeded if the remaining budget is less than estimate.
func (m *Manager) Acquire(ip string, estimateUSD float64) error {
	e := m.get(ip)
	e.mu.Lock()
	defer e.mu.Unlock()
	m.refreshIfExpired(e, time.Now())
	if e.remaining < estimateUSD {
		return ErrExceeded
	}
	return nil
}

// Charge deducts the actual cost from the IP's remaining budget. Negative
// remaining is clamped to zero.
func (m *Manager) Charge(ip string, actualUSD float64) {
	e := m.get(ip)
	e.mu.Lock()
	defer e.mu.Unlock()
	m.refreshIfExpired(e, time.Now())
	e.remaining -= actualUSD
	if e.remaining < 0 {
		e.remaining = 0
	}
}
