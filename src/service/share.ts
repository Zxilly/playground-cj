// Helper functions to convert between Base64URL and Base64
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(base64url: string): string {
  return base64url.replace(/-/g, '+').replace(/_/g, '/');
}

export async function loadShareCode(): Promise<string> {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const base64UrlData = params.get("data")
  if (!base64UrlData) {
    return ""
  }

  window.location.hash = ""

  const base64Data = base64UrlToBase64(base64UrlData);
  const data = Buffer.from(base64Data, "base64")
  const ds = new DecompressionStream("gzip")

  const decompressedStream = new Response(data).body!.pipeThrough(ds)
  return new Response(decompressedStream).text()
}

export async function generateShareUrl(code: string): Promise<string> {
  const encodedData = new TextEncoder().encode(code);

  const cs = new CompressionStream("gzip");
  const compressedStream = new Response(new Blob([encodedData])).body!.pipeThrough(cs);

  const compressedArrayBuffer = await new Response(compressedStream).arrayBuffer();

  let base64Data = Buffer.from(compressedArrayBuffer).toString("base64");

  const base64UrlData = base64ToBase64Url(base64Data);

  const params = new URLSearchParams({ data: base64UrlData });

  const url = new URL(window.location.href);
  url.hash = params.toString();

  return url.toString();
}
