package budget

import "strings"

// Price is USD per 1M tokens.
type Price struct {
	InputUSDPerMTok  float64
	OutputUSDPerMTok float64
}

// Conservative defaults; unknown models fall back to fallbackPrice.
var fallbackPrice = Price{InputUSDPerMTok: 30.0, OutputUSDPerMTok: 60.0}

// Hardcoded model pricing snapshot (May 2026). Keep keys lower-cased.
var modelPrices = map[string]Price{
	// OpenAI
	"gpt-4o":           {InputUSDPerMTok: 2.50, OutputUSDPerMTok: 10.00},
	"gpt-4o-mini":      {InputUSDPerMTok: 0.15, OutputUSDPerMTok: 0.60},
	"gpt-4.1":          {InputUSDPerMTok: 2.00, OutputUSDPerMTok: 8.00},
	"gpt-4.1-mini":     {InputUSDPerMTok: 0.40, OutputUSDPerMTok: 1.60},
	"gpt-4.1-nano":     {InputUSDPerMTok: 0.10, OutputUSDPerMTok: 0.40},
	"o4-mini":          {InputUSDPerMTok: 1.10, OutputUSDPerMTok: 4.40},
	"o3":               {InputUSDPerMTok: 2.00, OutputUSDPerMTok: 8.00},
	"o3-mini":          {InputUSDPerMTok: 1.10, OutputUSDPerMTok: 4.40},
	// Anthropic
	"claude-opus-4-7":   {InputUSDPerMTok: 15.00, OutputUSDPerMTok: 75.00},
	"claude-sonnet-4-6": {InputUSDPerMTok: 3.00, OutputUSDPerMTok: 15.00},
	"claude-haiku-4-5":  {InputUSDPerMTok: 1.00, OutputUSDPerMTok: 5.00},
	// Generic free-tier alias used by user's playground
	"playground-default": {InputUSDPerMTok: 0.15, OutputUSDPerMTok: 0.60},
}

// Lookup returns the canonical price for a given model identifier.
// It is forgiving of vendor prefixes such as "openai/" or trailing date suffixes.
func Lookup(model string) Price {
	if model == "" {
		return fallbackPrice
	}
	key := strings.ToLower(strings.TrimSpace(model))
	// Strip vendor prefix
	if idx := strings.Index(key, "/"); idx > 0 {
		key = key[idx+1:]
	}
	if p, ok := modelPrices[key]; ok {
		return p
	}
	// Try by stripping a trailing -YYYYMMDD or -YYYY-MM-DD style suffix
	if idx := strings.LastIndex(key, "-"); idx > 0 {
		trimmed := key[:idx]
		if p, ok := modelPrices[trimmed]; ok {
			return p
		}
	}
	return fallbackPrice
}

// Cost computes USD cost given input and output token counts.
func Cost(model string, inputTokens, outputTokens int) float64 {
	p := Lookup(model)
	return float64(inputTokens)/1_000_000.0*p.InputUSDPerMTok +
		float64(outputTokens)/1_000_000.0*p.OutputUSDPerMTok
}
