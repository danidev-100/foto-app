package payment

import (
	"context"
	"fmt"

	mpconfig "github.com/mercadopago/sdk-go/pkg/config"
	mppayment "github.com/mercadopago/sdk-go/pkg/payment"
	mppreference "github.com/mercadopago/sdk-go/pkg/preference"

	"foto-app/internal/domain/port"
)

// MercadoPago implements port.PaymentGateway using the official MP Go SDK.
type MercadoPago struct {
	prefClient mppreference.Client
	payClient  mppayment.Client
	sandbox    bool
}

// NewMercadoPago creates a MercadoPago adapter using the MP SDK.
func NewMercadoPago(accessToken string, sandbox bool) (*MercadoPago, error) {
	cfg, err := mpconfig.New(accessToken)
	if err != nil {
		return nil, fmt.Errorf("create mp config: %w", err)
	}

	return &MercadoPago{
		prefClient: mppreference.NewClient(cfg),
		payClient:  mppayment.NewClient(cfg),
		sandbox:    sandbox,
	}, nil
}

// CreatePreference creates a Checkout Pro preference for the given items.
func (mp *MercadoPago) CreatePreference(
	ctx context.Context,
	externalRef string,
	items []port.MPPreferenceItem,
	backURLs *port.MPBackURLs,
) (*port.MPPreference, error) {
	sdkItems := make([]mppreference.ItemRequest, len(items))
	for i, it := range items {
		unitPrice, _ := it.UnitPrice.Float64()
		sdkItems[i] = mppreference.ItemRequest{
			Title:      it.Title,
			Quantity:   it.Quantity,
			CurrencyID: it.CurrencyID,
			UnitPrice:  unitPrice,
		}
	}

	req := mppreference.Request{
		Items:             sdkItems,
		ExternalReference: externalRef,
		BinaryMode:        true,
	}

	if backURLs != nil {
		req.BackURLs = &mppreference.BackURLsRequest{
			Success: backURLs.Success,
			Pending: backURLs.Pending,
			Failure: backURLs.Failure,
		}
	}

	resp, err := mp.prefClient.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("mp create preference: %w", err)
	}

	initPoint := resp.InitPoint
	if mp.sandbox && resp.SandboxInitPoint != "" {
		initPoint = resp.SandboxInitPoint
	}

	return &port.MPPreference{
		ID:        resp.ID,
		InitPoint: initPoint,
	}, nil
}

// GetPaymentInfo retrieves payment details from MP by payment ID.
func (mp *MercadoPago) GetPaymentInfo(ctx context.Context, paymentID int) (*port.MPPaymentInfo, error) {
	resp, err := mp.payClient.Get(ctx, paymentID)
	if err != nil {
		return nil, fmt.Errorf("mp get payment %d: %w", paymentID, err)
	}

	return &port.MPPaymentInfo{
		ID:                resp.ID,
		Status:            resp.Status,
		StatusDetail:      resp.StatusDetail,
		ExternalReference: resp.ExternalReference,
		TransactionAmount: resp.TransactionAmount,
	}, nil
}
