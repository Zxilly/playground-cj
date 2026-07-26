import http.client
import os
import socket
import subprocess
import time

import modal


APP_NAME = "playground-cj-runner"
MAX_REQUEST_BYTES = 256 * 1024
RUNNER_IMAGE_NAME = "playground-cj-runner-runtime"
TOOLCHAIN_HEADER = "X-Playground-Cangjie-Toolchain-Lock-Sha256"

app = modal.App(APP_NAME)
runner_secret = modal.Secret.from_name("playground-cj-runner-auth")
gateway_image = modal.Image.debian_slim(python_version="3.13").uv_pip_install(
    "fastapi==0.116.1"
)
runner_image = modal.Image.from_name(RUNNER_IMAGE_NAME)


def _wait_for_runner(process: subprocess.Popen[bytes], timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            diagnostic = process.stderr.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"runner exited during startup with {process.returncode}: {diagnostic}"
            )
        try:
            with socket.create_connection(("127.0.0.1", 8000), timeout=0.1):
                return
        except OSError:
            time.sleep(0.05)
    raise TimeoutError("runner did not become ready")


@app.function(
    image=runner_image,
    secrets=[runner_secret],
    block_network=True,
    restrict_modal_access=True,
    single_use_containers=True,
    cpu=1.0,
    memory=4096,
    max_containers=20,
    timeout=30,
)
def execute_runner(
    action: str,
    body: bytes,
    content_type: str,
    authorization: str,
    toolchain_lock: str,
) -> tuple[int, dict[str, str], bytes]:
    if not os.path.isfile("/usr/bin/setpriv"):
        raise RuntimeError("runner image is missing /usr/bin/setpriv")
    environment = os.environ.copy()
    environment.update(
        {
            "CJ_RUNNER_ENV": "production",
            "CJ_RUNNER_ISOLATION_DRIVER": "modal-single-use-container",
            "TMPDIR": "/tmp",
        }
    )
    process = subprocess.Popen(
        ["/usr/local/bin/cj-runner"],
        env=environment,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    try:
        _wait_for_runner(process, timeout=15)
        connection = http.client.HTTPConnection("127.0.0.1", 8000, timeout=20)
        try:
            connection.request(
                "POST",
                f"/{action}",
                body=body,
                headers={
                    "Content-Type": content_type,
                    "Authorization": authorization,
                    TOOLCHAIN_HEADER: toolchain_lock,
                },
            )
            response = connection.getresponse()
            response_body = response.read()
            forwarded_headers: dict[str, str] = {}
            for name in (
                "Content-Type",
                "Retry-After",
                "X-Playground-Cangjie-Toolchain-Status",
            ):
                value = response.getheader(name)
                if value is not None:
                    forwarded_headers[name] = value
            return response.status, forwarded_headers, response_body
        finally:
            connection.close()
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


@app.function(
    image=gateway_image,
    cpu=0.5,
    memory=512,
    max_containers=20,
    scaledown_window=300,
    timeout=45,
)
@modal.concurrent(max_inputs=8)
@modal.asgi_app(label="runner", requires_proxy_auth=True)
def runner():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse, PlainTextResponse, Response

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    deployed_runner = modal.Function.from_name(APP_NAME, "execute_runner")

    @api.get("/")
    async def health():
        return PlainTextResponse("ok")

    async def execute(action: str, request: Request):
        raw_headers = request.scope["headers"]
        authorization_values = [
            value for name, value in raw_headers if name == b"authorization"
        ]
        content_type_values = [
            value for name, value in raw_headers if name == b"content-type"
        ]
        toolchain_values = [
            value
            for name, value in raw_headers
            if name == TOOLCHAIN_HEADER.lower().encode("ascii")
        ]
        required_headers = {
            "authorization": authorization_values,
            "content-type": content_type_values,
            TOOLCHAIN_HEADER.lower(): toolchain_values,
        }
        if any(len(values) != 1 for values in required_headers.values()):
            return JSONResponse(
                status_code=400,
                content={
                    "error": "invalid_runner_gateway_headers",
                    "message": "Runner gateway requires exactly one value for each protocol header.",
                },
            )

        body = await request.body()
        if len(body) > MAX_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "runner_gateway_body_too_large",
                    "message": "Runner gateway request body is too large.",
                },
            )

        try:
            status, headers, response_body = await deployed_runner.remote.aio(
                action,
                body,
                content_type_values[0].decode("latin-1"),
                authorization_values[0].decode("latin-1"),
                toolchain_values[0].decode("latin-1"),
            )
            return Response(content=response_body, status_code=status, headers=headers)
        except Exception as error:
            print(f"isolated runner request failed: {type(error).__name__}: {error}")
            return JSONResponse(
                status_code=503,
                headers={"Retry-After": "1"},
                content={
                    "error": "runner_gateway_unavailable",
                    "message": "The isolated runner could not be started.",
                },
            )

    @api.post("/run")
    async def run(request: Request):
        return await execute("run", request)

    @api.post("/format")
    async def format_code(request: Request):
        return await execute("format", request)

    return api
