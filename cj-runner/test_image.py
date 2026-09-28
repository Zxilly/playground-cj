"""Smoke-test a built runner image through its real loopback HTTP endpoint."""

import argparse
import hashlib
import json
import pathlib
import secrets
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('image', help='Docker image reference to verify')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
lock = json.loads((root / 'cj-runner/cangjie-toolchain.lock.json').read_text())
lock_hash = hashlib.sha256(json.dumps(lock, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
token = secrets.token_hex(32)
name = 'playground-cj-sts-smoke-' + secrets.token_hex(4)

def request(method, path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else b''
    headers = (
        f'{method} {path} HTTP/1.0\r\nHost: localhost\r\n'
        f'Authorization: Bearer {token}\r\n'
        f'X-Playground-Cangjie-Toolchain-Lock-Sha256: {lock_hash}\r\n'
        f'Content-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n'
    )
    response = subprocess.run([
        'docker', 'exec', '-i', name, '/bin/bash', '-c',
        'exec 3<>/dev/tcp/127.0.0.1/8000; cat >&3; cat <&3',
    ], input=headers.encode() + body, capture_output=True, check=True, timeout=30).stdout
    status, body = response.split(b'\r\n\r\n', 1)
    assert status.startswith(b'HTTP/1.0 200'), response
    return body

try:
    subprocess.run([
        'docker', 'run', '-d', '--rm', '--name', name,
        '--network', 'none',
        '-e', 'CJ_RUNNER_SHARED_TOKEN=' + token,
        '-e', 'CJ_RUNNER_ISOLATION_DRIVER=modal-single-use-container',
        args.image,
    ], check=True, stdout=subprocess.DEVNULL)
    for attempt in range(50):
        try:
            assert request('GET', '/') == b'ok'
            break
        except (ValueError, subprocess.CalledProcessError):
            time.sleep(.1)
    else:
        raise RuntimeError('Runner did not become ready')
    cases = [
        ('hello', 'main() { println("Hello, Cangjie!") }', '', 'Hello, Cangjie!\n'),
        ('stdx-base64', 'import stdx.encoding.base64.*\nmain() { println(toBase64String("test".toArray())) }', '', 'dGVzdA==\n'),
        ('stdin', 'import std.console.*\nmain() { println(Console.stdIn.readln() ?? "empty") }', 'input\n', 'input\n'),
    ]
    for label, code, stdin, output in cases:
        result = json.loads(request('POST', '/run', {'code': code, 'stdin': stdin}))
        assert result['compiler_code'] == 0, result
        assert 'Cangjie Compiler: ' + lock['release'] in result['compiler_output'], result
        assert result['bin_code'] == 0, result
        assert result['bin_stdout'] == output, result
        print(label + ': PASS')
except Exception:
    subprocess.run(['docker', 'logs', name])
    raise
finally:
    subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
