export interface WeChatAuthProvider {
  configured: boolean;
  authorizationUrl(callbackUrl: string): Promise<string>;
}

export interface PaymentProvider {
  name: string;
  createPayment(orderId: string, amountFen: number): Promise<{ providerOrderId: string }>;
}

export const disabledWeChatProvider: WeChatAuthProvider = {
  configured: false,
  async authorizationUrl() { throw new Error("WECHAT_NOT_CONFIGURED"); },
};

export const mockPaymentProvider: PaymentProvider = {
  name: "MOCK",
  async createPayment(orderId) { return { providerOrderId: `mock-${orderId}` }; },
};
