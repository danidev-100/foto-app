package port

import (
	"context"

	"github.com/shopspring/decimal"
)

// MPPreference represents a Mercado Pago Checkout Pro preference.
type MPPreference struct {
	ID        string `json:"id"`
	InitPoint string `json:"init_point"`
}

// MPPaymentInfo represents the current status of a Mercado Pago payment.
type MPPaymentInfo struct {
	ID        int     `json:"id"`
	Status    string  `json:"status"`
	StatusDetail string `json:"status_detail,omitempty"`
	ExternalReference string `json:"external_reference,omitempty"`
	TransactionAmount  float64 `json:"transaction_amount,omitempty"`
}

// PaymentGateway defines the interface for interacting with the Mercado Pago API.
// Implementations wrap the MP SDK or use direct HTTP calls.
type PaymentGateway interface {
	// CreatePreference creates a Checkout Pro preference for the given items.
	// Returns the preference ID and init_point URL.
	CreatePreference(ctx context.Context, externalRef string, items []MPPreferenceItem, backURLs *MPBackURLs) (*MPPreference, error)

	// GetPaymentInfo retrieves payment details from MP by payment ID.
	GetPaymentInfo(ctx context.Context, paymentID int) (*MPPaymentInfo, error)
}

// MPPreferenceItem represents a single item in an MP preference.
type MPPreferenceItem struct {
	Title    string          `json:"title"`
	Quantity int             `json:"quantity"`
	UnitPrice decimal.Decimal `json:"unit_price"`
	CurrencyID string        `json:"currency_id,omitempty"`
}

// MPBackURLs represents the callback URLs for MP Checkout Pro.
type MPBackURLs struct {
	Success string `json:"success,omitempty"`
	Pending string `json:"pending,omitempty"`
	Failure string `json:"failure,omitempty"`
}
