"""Compile and execute every checked-in Cangjie example with the locked Linux SDK.

Source the SDK's envsetup.sh before running. No third-party Python packages needed.
Macro packages are compiled separately and their commented main.cj is executed;
test macros are also compiled with --test (normal main() does not run tests).
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def command(args, cwd, timeout):
    with subprocess.Popen(
        [str(arg) for arg in args], cwd=cwd, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        encoding='utf-8', start_new_session=True,
    ) as process:
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
            raise RuntimeError(f'Timed out after {timeout}s: {args}\n{stdout}{stderr}')
    if process.returncode != 0:
        raise RuntimeError(f'Exit {process.returncode}: {args}\n{stdout}{stderr}')
    return stdout, stderr


def macro_consumer(source):
    """Extract the actual usage example instead of testing a separate copy."""
    lines = source.splitlines()
    marker = next((i for i, line in enumerate(lines)
                   if re.fullmatch(r'// (?:File|文件)[:：]\s*main\.cj', line)), None)
    if marker is None:
        raise ValueError('Macro package must include a // File: main.cj usage example')
    code = []
    for line in lines[marker + 1:]:
        if not line.startswith('//'):
            break
        code.append(line.removeprefix('//').removeprefix(' '))
        if line == '// }':
            break
    if not code or not any(line.startswith('main()') for line in code):
        raise ValueError('Macro package must include a commented main.cj usage example')
    return '\n'.join(code) + '\n'


def verify(path, compiler, expectations):
    source = (ROOT / path).read_text(encoding='utf-8')
    result = {'path': path, 'modes': [], 'status': 'passed'}
    try:
        with tempfile.TemporaryDirectory(prefix='playground-cj-verify-') as directory:
            work = Path(directory)
            macro = bool(re.search(r'^macro package\s', source, re.MULTILINE))
            if macro:
                (work / 'define.cj').write_text(source, encoding='utf-8')
                command([compiler, 'define.cj', '--compile-macro'], work, 60)
                source = macro_consumer(source)
                result['modes'].append('macro')
            (work / 'main.cj').write_text(source, encoding='utf-8')
            modes = ['normal']
            if re.search(r'^\s*@Test\b', source, re.MULTILINE):
                modes.append('test')
            for mode in modes:
                flags = ['--test'] if mode == 'test' else []
                command([compiler, 'main.cj', '--import-path', work, *flags, '-o', 'main'], work, 60)
                stdout, stderr = command([work / 'main'], work, 20)
                if mode == 'normal':
                    expected = expectations.get(path, {})
                    if macro and 'stdout' not in expected:
                        raise ValueError('Macro consumer must have an expected stdout assertion')
                    if 'stdout' in expected and stdout != expected['stdout']:
                        raise ValueError(f"Output mismatch: expected {expected['stdout']!r}, got {stdout!r}")
                    for fragment in expected.get('contains', []):
                        if fragment not in stdout:
                            raise ValueError(f'Missing {fragment!r} in stdout: {stdout!r}')
                    result.update(stdout=stdout, stderr=stderr)
                result['modes'].append(mode)
    except (OSError, ValueError, RuntimeError) as error:
        result.update(status='failed', error=str(error))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--report', type=Path, help='Optional JSON result file')
    args = parser.parse_args()
    if args.jobs < 1:
        parser.error('--jobs must be positive')
    if os.name != 'posix':
        parser.error('Use Linux or WSL with the locked linux-x64 SDK')
    sdk = os.environ.get('CANGJIE_HOME')
    candidate = os.environ.get('CJC') or (str(Path(sdk) / 'bin/cjc') if sdk else 'cjc')
    compiler = shutil.which(candidate)
    if not compiler:
        parser.error('Set CJC or source the locked SDK envsetup.sh first')
    lock = json.loads((ROOT / 'cj-runner/cangjie-toolchain.lock.json').read_text())
    digest = hashlib.sha256(Path(compiler).read_bytes()).hexdigest()
    if digest != lock['compiler']['executableSha256']:
        parser.error('Compiler SHA-256 does not match cj-runner/cangjie-toolchain.lock.json')
    version, _ = command([compiler, '--version'], ROOT, 10)
    expected_version = f"Cangjie Compiler: {lock['release']} (cjnative)\nTarget: {lock['compiler']['target']}"
    if version.strip() != expected_version:
        parser.error(f'Unexpected compiler identity: {version!r}')
    listing, _ = command(['git', 'ls-files', '-z', '*.cj'], ROOT, 10)
    paths = sorted(filter(None, listing.split('\0')))
    if not paths:
        parser.error('No tracked Cangjie files found')
    expectations = json.loads((ROOT / 'tests/cangjie-expectations.json').read_text(encoding='utf-8'))
    if set(expectations) - set(paths):
        parser.error('Output expectations refer to missing Cangjie files')
    print(version.strip(), flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for result in pool.map(lambda path: verify(path, compiler, expectations), paths):
            results.append(result)
            if result['status'] == 'failed':
                print(f"FAIL {result['path']}\n{result['error']}", flush=True)
            if len(results) % 40 == 0:
                print(f'Checked {len(results)}/{len(paths)}', flush=True)
    failed = sum(r['status'] == 'failed' for r in results)
    macros = sum('macro' in r['modes'] for r in results)
    tests = sum('test' in r['modes'] for r in results)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps({'compiler': version.strip(), 'sha256': digest, 'results': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(results)} files; {macros} macro consumers; {tests} test suites; {failed} failures.')
    return bool(failed)


if __name__ == '__main__':
    raise SystemExit(main())
