"""Run ATLAS on zserver host Node + move Cloudflared Windows service off the laptop."""
from __future__ import annotations

import paramiko
import time
from pathlib import Path

HOST = '192.168.1.30'
USER = 'administrator'
PASSWORD = 'Eunice73971177'
ROOT = r'C:\atlas'
LOCAL_ENV = Path(r'C:\Users\PC\Desktop\final-hakathon\atlas\deploy\zserver\atlas.env')
TUNNEL_TOKEN = (
    'eyJhIjoiZWM2ZWEyNGNkYTZmNjRiYzg0MjhiMzVhODM5YzUzNzUiLCJ0IjoiNDZkMGE5MjctMmI2MC00ZDFj'
    'LTk0NGItNjIwYjhmZDZmM2RlIiwicyI6Ik9HUTFOVEE0Wm1JdE1XWmhPUzAwWkRJeExXRm1ZalV0TTJNelpE'
    'TmlNR0kyT1dRdyJ9'
)


def run(c, cmd, timeout=1800):
    print('>>>', cmd[:220])
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode('utf-8', 'replace')
    code = o.channel.recv_exit_status()
    print(out[-4000:] if len(out) > 4000 else out)
    print('exit', code)
    return out, code


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=25, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()

    run(c, f'cd /d {ROOT} && git fetch origin && git reset --hard origin/main')
    sftp.put(str(LOCAL_ENV), f'{ROOT}/.env'.replace('\\', '/'))
    # also keep deploy copy
    sftp.put(str(LOCAL_ENV), f'{ROOT}/deploy/zserver/atlas.env'.replace('\\', '/'))

    # Stop broken docker cloudflared (127.0.0.1 inside container)
    run(c, 'docker rm -f atlas-cloudflared 2>nul')

    # Install deps + build web (long)
    run(c, f'cd /d {ROOT} && npm ci', timeout=1800)
    _out, build_code = run(c, f'cd /d {ROOT} && npm run build --workspace @atlas/web', timeout=1800)
    if build_code != 0:
        c.close()
        raise SystemExit(f'web build failed on zserver (exit {build_code})')

    # Free ports / kill old atlas node
    run(
        c,
        'powershell -NoProfile -Command "'
        "$p=Get-NetTCPConnection -LocalPort 3000,4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; "
        "foreach($i in $p){ if($i){ Stop-Process -Id $i -Force -ErrorAction SilentlyContinue } }; "
        "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*atlas*' } | Stop-Process -Force -ErrorAction SilentlyContinue; "
        'Write-Host cleaned"',
    )

    # Detached start via schtasks (survives SSH disconnect; plain `start` dies with the session)
    run(c, f'if not exist {ROOT}\\deploy\\zserver\\logs mkdir {ROOT}\\deploy\\zserver\\logs')
    sftp.put(
        str(Path(__file__).resolve().parent.parent / 'deploy' / 'zserver' / 'start-gateway.bat'),
        f'{ROOT}/deploy/zserver/start-gateway.bat'.replace('\\', '/'),
    )
    sftp.put(
        str(Path(__file__).resolve().parent.parent / 'deploy' / 'zserver' / 'start-web.bat'),
        f'{ROOT}/deploy/zserver/start-web.bat'.replace('\\', '/'),
    )
    for task, bat in (
        ('AtlasGateway', f'{ROOT}\\deploy\\zserver\\start-gateway.bat'),
        ('AtlasWeb', f'{ROOT}\\deploy\\zserver\\start-web.bat'),
    ):
        run(c, f'schtasks /Delete /TN "{task}" /F 2>nul')
        run(c, f'schtasks /Create /TN "{task}" /TR "\\"{bat}\\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F')
        run(c, f'schtasks /Run /TN "{task}"')
    time.sleep(5)

    for _ in range(30):
        time.sleep(3)
        out, _code = run(
            c,
            'powershell -NoProfile -Command "try{(Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing -TimeoutSec 5).Content}catch{\'WAIT\'}"',
            timeout=30,
        )
        if 'ok' in out.lower() or 'atlas' in out.lower():
            break

    # Install / update Cloudflared Windows service on zserver for atlast tunnel
    run(c, 'where cloudflared')
    # Remove existing service if present then create
    run(c, 'sc.exe stop CloudflaredAtlas 2>nul & sc.exe delete CloudflaredAtlas 2>nul')
    bin_path = r'C:\Windows\System32\cloudflared.exe'
    # Prefer Program Files copy if System32 missing
    out, _ = run(c, 'if exist "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe" (echo PF) else (echo SYS)')
    if 'PF' in out:
        bin_path = r'C:\Program Files (x86)\cloudflared\cloudflared.exe'
    # sc.exe needs quoted binPath carefully
    create = (
        f'sc.exe create CloudflaredAtlas binPath= "\\"{bin_path}\\" tunnel run --token {TUNNEL_TOKEN}" '
        f'start= auto DisplayName= "Cloudflared ATLAS (atlast.strimetv.site)"'
    )
    run(c, create)
    run(c, 'sc.exe start CloudflaredAtlas')
    time.sleep(4)
    run(c, 'sc.exe query CloudflaredAtlas')

    c.close()
    print('NATIVE DEPLOY DONE — now stop laptop Cloudflared')


if __name__ == '__main__':
    main()
