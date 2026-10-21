export interface AdSenseConfig {
  clientId: string;
  slotSetup: string;
  enabled: boolean;
  scriptSrc: string | null;
}

const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d{10,20}$/;

/**
 * Google AdSense クライアントID（ca-pub-xxxxxxxxxxxxxxxx）の形式が有効かどうかを判定する
 */
export function isValidAdSenseClientId(clientId?: string): boolean {
  if (!clientId) return false;
  return ADSENSE_CLIENT_ID_PATTERN.test(clientId.trim());
}

/**
 * 環境変数または引数から Google AdSense 設定を安全に取得する
 */
export function getAdSenseConfig(env?: {
  clientId?: string;
  slotSetup?: string;
}): AdSenseConfig {
  const rawClientId = (
    env?.clientId ??
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ??
    ''
  ).trim();
  const rawSlotSetup = (
    env?.slotSetup ??
    process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP ??
    ''
  ).trim();

  const enabled = isValidAdSenseClientId(rawClientId);

  return {
    clientId: enabled ? rawClientId : '',
    slotSetup: rawSlotSetup,
    enabled,
    scriptSrc: enabled
      ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${rawClientId}`
      : null,
  };
}
