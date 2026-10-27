#!/usr/bin/env python3
"""Build without persisting proxy credentials or weakening TLS.
Resolve only the already-configured proxy host for BuildKit's isolated DNS.
"""
import os
from pathlib import Path
import socket
import subprocess
import sys
from urllib.parse import urlsplit

tag = sys.argv[1] if len(sys.argv) > 1 else 'berjis:local'
if tag.startswith('-'):
    raise SystemExit('Invalid image tag')
args = ['docker', 'build', '--tag', tag]
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
if proxy:
    host = urlsplit(proxy).hostname
    if not host:
        raise SystemExit('Configured proxy has no hostname')
    address = socket.gethostbyname(host)
    args += ['--add-host', f'{host}:{address}']
for name in ('HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'):
    if os.environ.get(name):
        args += ['--build-arg', name]  # Docker reads the value from the environment.
cert = os.environ.get('NODE_EXTRA_CA_CERTS')
if cert and Path(cert).is_file():
    args += ['--secret', f'id=proxy_ca,src={cert}']
args += ['.']
raise SystemExit(subprocess.call(args, cwd=Path(__file__).resolve().parent.parent))
