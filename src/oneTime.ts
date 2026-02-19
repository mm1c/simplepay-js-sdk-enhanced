import crypto from "crypto";
import {
  Currency,
  PaymentConfig,
  PaymentData,
  SimplePayCancelTransactionRequestBody,
  SimplePayRequestBody,
} from "./types";
import {
  simplepayLogger,
  getSimplePayConfig,
  toISO8601DateString,
  makeSimplePayRequest,
  makeSimplePayCancelTransactionRequest,
} from "./utils";

const getValidatedConfig = (
  fnName: string,
  currency: Currency,
  logExtra: Record<string, unknown> = {},
) => {
  simplepayLogger({ function: fnName, ...logExtra });
  const config = getSimplePayConfig(currency);
  simplepayLogger({
    function: fnName,
    MERCHANT_KEY: config.MERCHANT_KEY,
    MERCHANT_ID: config.MERCHANT_ID,
  });

  if (!config.MERCHANT_KEY || !config.MERCHANT_ID) {
    throw new Error(`Missing SimplePay configuration for ${currency}`);
  }

  return config;
};

const startPayment = async (
  paymentData: PaymentData,
  config: PaymentConfig = {},
) => {
  const currency = paymentData.currency || "HUF";
  const { MERCHANT_KEY, MERCHANT_ID, API_URL_PAYMENT, SDK_VERSION } =
    getValidatedConfig("SimplePay/startPayment", currency, { paymentData });

  const requestBody: SimplePayRequestBody = {
    salt: crypto.randomBytes(16).toString("hex"),
    merchant: MERCHANT_ID!,
    orderRef: paymentData.orderRef,
    currency: currency.replace("_SZEP", "") as Currency,
    customerEmail: paymentData.customerEmail,
    language: paymentData.language || "HU",
    sdkVersion: SDK_VERSION,
    methods: [paymentData.method || "CARD"],
    total: String(paymentData.total),
    timeout: toISO8601DateString(new Date(Date.now() + 30 * 60 * 1000)),
    url:
      config.redirectUrl ||
      process.env.SIMPLEPAY_REDIRECT_URL ||
      "http://url.to.redirect",
    invoice: paymentData.invoice,
  };

  return makeSimplePayRequest(API_URL_PAYMENT, requestBody, MERCHANT_KEY!);
};

const cancelTransaction = async (
  paymentData: PaymentData
) => {
  const currency = paymentData.currency || "HUF";
  const { MERCHANT_KEY, MERCHANT_ID, SDK_VERSION, API_URL_TRANSACTION_CANCEL } =
    getValidatedConfig(
      "SimplePay/cancelTransaction",
      paymentData.currency as Currency,
      {
        paymentData,
      },
    );

  if (
    !paymentData.transactionId ||
    paymentData.transactionId.trim().length !== 9 ||
    isNaN(parseInt(paymentData.transactionId))
  ) {
    throw new Error("transactionId is required for cancelTransaction");
  }

  const requestBody: SimplePayCancelTransactionRequestBody = {
    salt: crypto.randomBytes(16).toString("hex"),
    merchant: MERCHANT_ID!,
    currency: currency.replace("_SZEP", "") as Currency,
    sdkVersion: SDK_VERSION,
    transactionId: paymentData.transactionId,
  };

  return makeSimplePayCancelTransactionRequest(
    API_URL_TRANSACTION_CANCEL,
    requestBody,
    MERCHANT_KEY!,
  );
};

export { startPayment, cancelTransaction };
