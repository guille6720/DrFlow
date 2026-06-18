import type { Payment, PaymentStatus } from "@/types/database";

export interface PaymentIntent {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  amount: number;
  depositAmount?: number;
}

export interface PaymentResult {
  id: string;
  status: PaymentStatus;
  mockTransactionId: string;
  paidAt?: string;
}

export interface PaymentService {
  createPayment(intent: PaymentIntent): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}

class MockMercadoPagoService implements PaymentService {
  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    const mockId = `mock_mp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    // Simulated approval — replace with Mercado Pago SDK
    return {
      id: mockId,
      status: "paid",
      mockTransactionId: mockId,
      paidAt: new Date().toISOString(),
    };
  }

  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    return "paid";
  }
}

export const paymentService: PaymentService = new MockMercadoPagoService();

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

export type { Payment };
