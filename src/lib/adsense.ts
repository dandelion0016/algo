export interface AdSenseConfig {
  clientId: string;
  slotSetup: string;
  enabled: boolean;
  scriptSrc: string | null;
}

export const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-3337160908225388';

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
 * 引数 env?.clientId または process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID が未指定・空文字の場合は DEFAULT_ADSENSE_CLIENT_ID にフォールバックする
 */
export function getAdSenseConfig(env?: {
  clientId?: string;
  slotSetup?: string;
}): AdSenseConfig {
  const specifiedClientId = env?.clientId ?? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const rawClientId =
    specifiedClientId !== undefined && specifiedClientId.trim() !== ''
      ? specifiedClientId.trim()
      : DEFAULT_ADSENSE_CLIENT_ID;

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
