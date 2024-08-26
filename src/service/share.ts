import {compressToEncodedURIComponent, decompressFromEncodedURIComponent} from "lz-string";

export function loadShareCode(): string {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const base64UrlData = params.get("data")
  if (!base64UrlData) {
    return ""
  }

  window.location.hash = ""

  return decompressFromEncodedURIComponent(base64UrlData)
}

export function generateShareUrl(code: string): string {
  const base64UrlData = compressToEncodedURIComponent(code)

  const params = new URLSearchParams({data: base64UrlData});

  const url = new URL(window.location.href);
  url.hash = params.toString();

  return url.toString();
}
