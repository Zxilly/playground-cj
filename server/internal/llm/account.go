package llm

import (
	"context"
	"os"

	"github.com/maximhq/bifrost/core/schemas"
)

// envAccount is a minimal Account that loads provider keys from environment
// variables. Recognised env vars:
//
//	OPENAI_API_KEY
//	ANTHROPIC_API_KEY
//
// Each non-empty key registers the corresponding provider with bifrost.
type envAccount struct{}

func newEnvAccount() *envAccount {
	return &envAccount{}
}

func (a *envAccount) GetConfiguredProviders() ([]schemas.ModelProvider, error) {
	out := make([]schemas.ModelProvider, 0, 2)
	if os.Getenv("OPENAI_API_KEY") != "" {
		out = append(out, schemas.OpenAI)
	}
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		out = append(out, schemas.Anthropic)
	}
	return out, nil
}

func (a *envAccount) GetKeysForProvider(_ context.Context, providerKey schemas.ModelProvider) ([]schemas.Key, error) {
	switch providerKey {
	case schemas.OpenAI:
		key := os.Getenv("OPENAI_API_KEY")
		if key == "" {
			return nil, nil
		}
		return []schemas.Key{{ID: "openai-default", Value: schemas.EnvVar{Val: key}, Models: []string{}, Weight: 1}}, nil
	case schemas.Anthropic:
		key := os.Getenv("ANTHROPIC_API_KEY")
		if key == "" {
			return nil, nil
		}
		return []schemas.Key{{ID: "anthropic-default", Value: schemas.EnvVar{Val: key}, Models: []string{}, Weight: 1}}, nil
	}
	return nil, nil
}

func (a *envAccount) GetConfigForProvider(_ schemas.ModelProvider) (*schemas.ProviderConfig, error) {
	return &schemas.ProviderConfig{}, nil
}
