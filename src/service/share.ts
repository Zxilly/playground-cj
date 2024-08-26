import {compressToBase64, decompressFromEncodedURIComponent} from "lz-string";

function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(base64url: string): string {
  return base64url.replace(/-/g, '+').replace(/_/g, '/');
}

export function loadShareCode(): string {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const base64UrlData = params.get("data")
  if (!base64UrlData) {
    return ""
  }

  window.location.hash = ""

  return decompressFromEncodedURIComponent(base64UrlToBase64(base64UrlData))
}

export function generateShareUrl(code: string): string {
  const base64UrlData = base64ToBase64Url(compressToBase64(code))

  const params = new URLSearchParams({data: base64UrlData});

  const url = new URL(window.location.href);
  url.hash = params.toString();

  return url.toString();
}
