const MOBILE_WHATSAPP_UA = /Android|iPhone|iPad|iPod/i;

const cleanPhone = (phone: string | null | undefined) => (phone ?? "").replace(/[^0-9]/g, "");

export const buildWhatsAppUrls = (phone: string | null | undefined, message: string) => {
  const normalizedPhone = cleanPhone(phone);
  const encoded = encodeURIComponent(message);

  return {
    phone: normalizedPhone,
    appUrl: `whatsapp://send?phone=${normalizedPhone}&text=${encoded}`,
    webUrl: normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`,
  };
};

export const openWhatsAppApp = (phone: string | null | undefined, message: string) => {
  const { appUrl, webUrl } = buildWhatsAppUrls(phone, message);

  if (!MOBILE_WHATSAPP_UA.test(navigator.userAgent)) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  let handedOff = false;
  let timer: number | null = null;

  const onVisibilityChange = () => {
    if (document.hidden) {
      handedOff = true;
      cleanup();
    }
  };

  const onBlur = () => {
    handedOff = true;
    cleanup();
  };

  const cleanup = () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onBlur);
    if (timer != null) window.clearTimeout(timer);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onBlur);

  timer = window.setTimeout(() => {
    cleanup();
    if (!handedOff) {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
  }, 900);

  window.location.href = appUrl;
};