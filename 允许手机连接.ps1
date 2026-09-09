# 只为言叶开放局域网端口，不关闭防火墙。
# 在 PowerShell 中运行本文件；Windows 会按需请求管理员权限。
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'))
    exit
}
$rule = Get-NetFirewallRule -Name 'Kotoba-Local-iPhone' -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -Name 'Kotoba-Local-iPhone' -DisplayName 'Kotoba Local iPhone (8765, 8443)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765,8443 -RemoteAddress LocalSubnet -Profile Any
}
